import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Material } from "../../../../generated/prisma/client";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { CreditOperationsService } from "../../../credit/application/services/credit-operations.service";
import {
  assertPublishableFile,
  materialFee,
  type PurchasedFileSnapshot,
} from "../../domain/material.policy";
import { orderView } from "../contracts/material-view";
import {
  auditContext,
  lockMaterial,
  requirePermission,
  roleCodes,
} from "./material-support";

@Injectable()
export class MaterialPurchaseService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly credit: CreditOperationsService,
    private readonly audit: AuditWriter,
  ) {}

  /**
   * FR-MAT-05 / BR-43: check, debit, credit, fee, order and entitlement commit together.
   * Retries and repeat purchases return the existing order without charging again.
   * Async so permission and key failures surface as rejections, like every other failure.
   */
  async purchase(
    principal: Principal,
    materialId: string,
    expectedListingVersion: number,
    idempotencyKey: string | undefined,
  ) {
    requirePermission(principal, "material:access");
    const key = orderKey(principal.userId, idempotencyKey);
    return this.transactions.run(async (tx) => {
      const replay = await tx.materialOrder.findUnique({
        where: { idempotencyKey: key },
      });
      if (replay) {
        if (replay.materialId !== materialId)
          throw new ConflictException("IDEMPOTENCY_KEY_REUSED");
        return { order: orderView(replay), replayed: true };
      }
      const material = await lockMaterial(tx, materialId);
      const owned = await tx.materialEntitlement.findUnique({
        where: { userId_materialId: { userId: principal.userId, materialId } },
        include: { sourceOrderIdRecord: true },
      });
      if (owned?.status === "ACTIVE" && owned.sourceOrderIdRecord)
        return { order: orderView(owned.sourceOrderIdRecord), replayed: true };
      assertPurchasable(material, principal.userId, expectedListingVersion);
      const policy = await activeFeePolicy(tx);
      const { fee, net } = materialFee(material.priceCredit, policy.feeBps);
      const orderId = randomUUID();
      const { operationId } = await this.credit.purchaseMaterial(tx, {
        orderId,
        buyerId: principal.userId,
        sellerId: material.ownerId,
        gross: material.priceCredit,
        fee,
      });
      const order = await tx.materialOrder.create({
        data: {
          id: orderId,
          buyerId: principal.userId,
          sellerId: material.ownerId,
          materialId,
          purchasedFileSnapshot: fileSnapshot(material),
          listingVersion: material.listingVersion,
          grossCredit: material.priceCredit,
          feeAmount: fee,
          sellerNetCredit: net,
          feePolicyId: policy.id,
          feeSnapshot: policy.snapshot,
          operationId,
          status: "SUCCESS",
          idempotencyKey: key,
        },
      });
      await tx.materialEntitlement.create({
        data: {
          userId: principal.userId,
          materialId,
          sourceOrderId: orderId,
          sourceType: "PURCHASE",
          status: "ACTIVE",
          grantedAt: new Date(),
        },
      });
      await this.audit.append(tx, {
        actor: {
          kind: "HUMAN",
          userId: principal.userId,
          roles: roleCodes(principal),
        },
        action: "MATERIAL_PURCHASE",
        target: { type: "MATERIAL_ORDER", id: orderId },
        after: {
          materialId,
          grossCredit: material.priceCredit.toString(),
          feeAmount: fee.toString(),
          operationId,
        },
        reason: "Material purchase",
        context: auditContext(),
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "MATERIAL_ORDER",
          aggregateId: orderId,
          version: 1,
          type: "material.purchased",
          payload: {
            orderId,
            materialId,
            buyerId: principal.userId,
            sellerId: material.ownerId,
          },
          dedupeKey: `material-purchased:${orderId}`,
          correlationId: randomUUID(),
        },
      });
      return { order: orderView(order), replayed: false };
    });
  }

  async refund(principal: Principal, orderId: string) {
    requirePermission(principal, "material:access");
    return this.transactions.run(async (tx) => {
      await tx.$queryRaw`SELECT order_id FROM material_orders WHERE order_id = ${orderId}::uuid FOR UPDATE`;
      const order = await tx.materialOrder.findUnique({
        where: { id: orderId },
      });
      if (!order || order.buyerId !== principal.userId)
        throw new NotFoundException("MATERIAL_ORDER_NOT_FOUND");
      if (order.status === "REFUNDED")
        return { order: orderView(order), replayed: true };
      if (order.status !== "SUCCESS")
        throw new ConflictException("MATERIAL_ORDER_NOT_REFUNDABLE");
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (
        !clock?.now ||
        clock.now.getTime() > order.createdAt.getTime() + 24 * 60 * 60 * 1_000
      )
        throw new ConflictException("MATERIAL_REFUND_WINDOW_CLOSED");
      if (order.consumedAt)
        throw new ConflictException("MATERIAL_ALREADY_CONSUMED");
      const entitlement = await tx.materialEntitlement.findUnique({
        where: { sourceOrderId: order.id },
      });
      if (entitlement?.status !== "ACTIVE")
        throw new ConflictException("MATERIAL_ENTITLEMENT_NOT_ACTIVE");
      const { operationId } = await this.credit.refundMaterial(tx, {
        orderId: order.id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        gross: order.grossCredit,
        net: order.sellerNetCredit,
      });
      const refunded = await tx.materialOrder.update({
        where: { id: order.id },
        data: { status: "REFUNDED" },
      });
      await tx.materialEntitlement.update({
        where: { id: entitlement.id },
        data: {
          status: "REVOKED",
          revokedAt: clock.now,
          revokedReason: "PURCHASE_REFUNDED",
        },
      });
      await this.audit.append(tx, {
        actor: {
          kind: "HUMAN",
          userId: principal.userId,
          roles: roleCodes(principal),
        },
        action: "MATERIAL_REFUND",
        target: { type: "MATERIAL_ORDER", id: order.id },
        after: { grossCredit: order.grossCredit.toString(), operationId },
        reason:
          "Material purchase refunded within the unconsumed refund window",
        context: auditContext(),
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "MATERIAL_ORDER",
          aggregateId: order.id,
          version: 2,
          type: "material.refunded",
          payload: {
            orderId: order.id,
            materialId: order.materialId,
            buyerId: order.buyerId,
            sellerId: order.sellerId,
          },
          dedupeKey: `material-refunded:${order.id}`,
          correlationId: randomUUID(),
        },
      });
      return { order: orderView(refunded), replayed: false };
    });
  }

  listOrders(principal: Principal) {
    return this.transactions.run(async (tx) => {
      // ponytail: newest 100 only; paginate when a buyer exceeds it.
      const rows = await tx.materialOrder.findMany({
        where: { buyerId: principal.userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      });
      return rows.map(orderView);
    });
  }
}

/** Keys are scoped per buyer so two users can never collide on the unique column. */
function orderKey(buyerId: string, key: string | undefined): string {
  const value = key?.trim();
  if (!value || value.length > 200 || !/^[\x21-\x7e]+$/u.test(value))
    throw new BadRequestException("IDEMPOTENCY_KEY_REQUIRED");
  return `${buyerId}:${value}`;
}

function assertPurchasable(
  material: Material,
  buyerId: string,
  expectedListingVersion: number,
): void {
  if (material.ownerId === buyerId)
    throw new ConflictException("MATERIAL_SELF_PURCHASE");
  if (material.accessType !== "PAID")
    throw new ConflictException("MATERIAL_NOT_PAID");
  if (material.status !== "PUBLISHED")
    throw new ConflictException("MATERIAL_NOT_PUBLISHED");
  assertPublishableFile(material);
  if (material.listingVersion !== expectedListingVersion)
    throw new ConflictException("MATERIAL_PRICE_CHANGED");
}

function fileSnapshot(material: Material): PurchasedFileSnapshot {
  return {
    storageKey: material.storageKey as string,
    originalFilename: material.originalFilename,
    mimeType: material.mimeType,
    sizeBytes: material.sizeBytes?.toString() ?? null,
    checksum: material.checksum,
    distributionRightsConfirmedAt:
      material.distributionRightsConfirmedAt?.toISOString() ?? null,
    uploadedAt: material.uploadedAt?.toISOString() ?? null,
  };
}

/** BR-44: PAID purchase stays locked until an APPROVED, effective policy exists. */
async function activeFeePolicy(tx: TransactionContext) {
  const [clock] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT CURRENT_TIMESTAMP AS now`;
  if (!(clock?.now instanceof Date))
    throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
  const policy = await tx.feePolicyVersion.findFirst({
    where: {
      policyCode: "MATERIAL_PAID",
      status: "APPROVED",
      approvedAt: { not: null },
      effectiveAt: { lte: clock.now },
    },
    orderBy: { versionNo: "desc" },
  });
  const rounding = policy?.roundingRule as {
    mode?: unknown;
    precision?: unknown;
  } | null;
  if (!policy || rounding?.mode !== "DOWN" || rounding.precision !== 2)
    throw new ConflictException("MATERIAL_FEE_POLICY_UNAVAILABLE");
  return {
    id: policy.id,
    feeBps: (policy.calculationRule as { feeBps?: unknown } | null)?.feeBps,
    snapshot: {
      policyCode: policy.policyCode,
      versionNo: policy.versionNo,
      calculationRule: policy.calculationRule,
      roundingRule: policy.roundingRule,
    },
  };
}
