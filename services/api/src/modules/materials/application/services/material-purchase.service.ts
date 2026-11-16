import {
  listInput,
  listBoundary,
  listResult,
} from "../../../../shared/http/list-page";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { Material } from "../../../../generated/prisma/client";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { IdempotencyService } from "../../../../infrastructure/idempotency/idempotency.service";
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
    private readonly idempotency: IdempotencyService,
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
    const result = await this.idempotency.execute(
      {
        scope: `material-purchase:${principal.userId}`,
        operation: "purchase",
        key: idempotencyRecordKey(key),
        command: { materialId },
        conflictMessage: "IDEMPOTENCY_KEY_REUSED",
      },
      async (tx) => {
        const replay = await tx.materialOrder.findUnique({
          where: { idempotencyKey: key },
        });
        if (replay) {
          if (replay.materialId !== materialId)
            throw new ConflictException("IDEMPOTENCY_KEY_REUSED");
          return { id: replay.id, status: "EXISTING" };
        }
        const material = await lockMaterial(tx, materialId);
        await tx.$queryRaw`SELECT entitlement_id FROM material_entitlements
          WHERE user_id = ${principal.userId}::uuid AND material_id = ${materialId}::uuid
          FOR UPDATE`;
        const owned = await tx.materialEntitlement.findUnique({
          where: {
            userId_materialId: { userId: principal.userId, materialId },
          },
          include: { sourceOrderIdRecord: true },
        });
        if (owned?.status === "ACTIVE" && owned.sourceOrderIdRecord)
          return { id: owned.sourceOrderIdRecord.id, status: "EXISTING" };
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
        await tx.materialOrder.create({
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
        const [clock] = await tx.$queryRaw<
          { now: Date }[]
        >`SELECT CURRENT_TIMESTAMP AS now`;
        if (!(clock?.now instanceof Date))
          throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
        if (owned) {
          await tx.materialEntitlement.update({
            where: { id: owned.id },
            data: {
              sourceOrderId: orderId,
              sourceType: "PURCHASE",
              status: "ACTIVE",
              grantedAt: clock.now,
              revokedAt: null,
              revokedReason: null,
            },
          });
        } else {
          await tx.materialEntitlement.create({
            data: {
              userId: principal.userId,
              materialId,
              sourceOrderId: orderId,
              sourceType: "PURCHASE",
              status: "ACTIVE",
              grantedAt: clock.now,
            },
          });
        }
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
        return { id: orderId, status: "CREATED" };
      },
    );
    const order = await this.transactions.run((tx) =>
      tx.materialOrder.findUniqueOrThrow({ where: { id: result.value.id } }),
    );
    return {
      order: orderView(order),
      replayed: result.replayed || result.value.status === "EXISTING",
    };
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
      await tx.materialDownloadGrant.updateMany({
        where: {
          orderId: order.id,
          status: "PENDING",
          expiresAt: { lte: clock.now },
        },
        data: { status: "EXPIRED" },
      });
      const blockingGrant = await tx.materialDownloadGrant.findFirst({
        where: {
          orderId: order.id,
          OR: [
            { status: "ISSUED" },
            { status: "PENDING", expiresAt: { gt: clock.now } },
          ],
        },
        select: { id: true },
      });
      if (blockingGrant)
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

  async listOrders(
    principal: Principal,
    query: { limit?: number; cursor?: string } = {},
  ) {
    const scope = JSON.stringify(["material-orders-v1", principal.userId]);
    const { limit, cursor } = listInput(query, scope);
    return this.transactions.run(async (tx) => {
      const rows = await tx.materialOrder.findMany({
        where: {
          buyerId: principal.userId,
          ...listBoundary("createdAt", cursor),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });
      const result = listResult(rows, limit, scope, (row) => row.createdAt);
      const pageRows = result.data;
      const materialIds = [...new Set(pageRows.map((row) => row.materialId))];
      const orderIds = pageRows.map((row) => row.id);
      const sellerIds = [...new Set(pageRows.map((row) => row.sellerId))];
      const [clock, reviews, entitlements, grants, wallets, materials] =
        await Promise.all([
          tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS now`,
          tx.materialReview.findMany({
            where: {
              authorId: principal.userId,
              materialId: { in: materialIds },
              deletedAt: null,
            },
          }),
          tx.materialEntitlement.findMany({
            where: {
              userId: principal.userId,
              materialId: { in: materialIds },
              status: "ACTIVE",
            },
          }),
          tx.materialDownloadGrant.findMany({
            where: {
              orderId: { in: orderIds },
              status: { in: ["ISSUED", "PENDING"] },
            },
          }),
          tx.creditWallet.findMany({ where: { userId: { in: sellerIds } } }),
          tx.material.findMany({
            where: { id: { in: materialIds } },
            select: { id: true, status: true },
          }),
        ]);
      const evaluatedAt = clock[0]?.now;
      if (!(evaluatedAt instanceof Date))
        throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
      const reviewByMaterial = new Map(
        reviews.map((review) => [review.materialId, review]),
      );
      const entitlementByMaterial = new Map(
        entitlements.map((entitlement) => [
          entitlement.materialId,
          entitlement,
        ]),
      );
      const grantsByOrder = new Map<string, (typeof grants)[number][]>();
      for (const grant of grants) {
        if (!grant.orderId) continue;
        const entries = grantsByOrder.get(grant.orderId) ?? [];
        entries.push(grant);
        grantsByOrder.set(grant.orderId, entries);
      }
      const walletByUser = new Map(
        wallets.map((wallet) => [wallet.userId, wallet]),
      );
      const statusByMaterial = new Map(
        materials.map((material) => [material.id, material.status]),
      );
      return {
        ...result,
        data: pageRows.map((order) => ({
          ...orderView(order),
          purchasedMaterial: purchasedMaterialView(order.purchasedFileSnapshot),
          review: orderReviewView(
            order,
            reviewByMaterial.get(order.materialId),
            entitlementByMaterial.get(order.materialId),
            statusByMaterial.get(order.materialId),
          ),
          refundEligibility: refundEligibilityView(
            order,
            grantsByOrder.get(order.id) ?? [],
            entitlementByMaterial.get(order.materialId),
            walletByUser.get(order.sellerId),
            evaluatedAt,
          ),
        })),
      };
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

function idempotencyRecordKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
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
    title: material.title,
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

function purchasedMaterialView(snapshot: unknown) {
  const value = (snapshot ?? {}) as Record<string, unknown>;
  return {
    title: typeof value.title === "string" ? value.title : null,
    originalFilename:
      typeof value.originalFilename === "string"
        ? value.originalFilename
        : null,
    mimeType: typeof value.mimeType === "string" ? value.mimeType : null,
    sizeBytes: typeof value.sizeBytes === "string" ? value.sizeBytes : null,
  };
}

function orderReviewView(
  order: { id: string },
  review:
    | {
        id: string;
        status: string;
        version: number;
        sourceOrderId: string | null;
      }
    | undefined,
  entitlement: { status: string; sourceOrderId: string | null } | undefined,
  materialStatus: string | undefined,
) {
  if (review)
    return {
      hasReview: true,
      reviewId: review.id,
      status: review.status,
      version: review.version,
      sourceOrderId: review.sourceOrderId,
      canReview: false,
      reasonCode: "MATERIAL_REVIEW_ALREADY_EXISTS",
    };
  const canReview =
    materialStatus === "PUBLISHED" &&
    entitlement?.status === "ACTIVE" &&
    entitlement.sourceOrderId === order.id;
  return {
    hasReview: false,
    reviewId: null,
    status: null,
    version: null,
    sourceOrderId: null,
    canReview,
    reasonCode: canReview
      ? null
      : materialStatus !== "PUBLISHED"
        ? "MATERIAL_NOT_PUBLISHED"
        : "MATERIAL_ENTITLEMENT_REVOKED",
  };
}

function refundEligibilityView(
  order: {
    id: string;
    status: string;
    consumedAt: Date | null;
    createdAt: Date;
    sellerNetCredit: bigint;
  },
  grants: { status: string; expiresAt: Date }[],
  entitlement: { status: string; sourceOrderId: string | null } | undefined,
  sellerWallet:
    { availableCredit: bigint; provenanceTracked: boolean } | undefined,
  evaluatedAt: Date,
) {
  const deadline = new Date(order.createdAt.getTime() + 24 * 60 * 60 * 1_000);
  let reasonCode: string | null = null;
  if (order.status === "REFUNDED") reasonCode = "MATERIAL_ALREADY_REFUNDED";
  else if (order.status !== "SUCCESS")
    reasonCode = "MATERIAL_ORDER_NOT_REFUNDABLE";
  else if (evaluatedAt.getTime() > deadline.getTime())
    reasonCode = "MATERIAL_REFUND_WINDOW_CLOSED";
  else if (order.consumedAt) reasonCode = "MATERIAL_ALREADY_CONSUMED";
  else if (
    grants.some(
      (grant) =>
        grant.status === "ISSUED" ||
        (grant.status === "PENDING" && grant.expiresAt > evaluatedAt),
    )
  )
    reasonCode = "MATERIAL_ALREADY_CONSUMED";
  else if (
    entitlement?.status !== "ACTIVE" ||
    entitlement.sourceOrderId !== order.id
  )
    reasonCode = "MATERIAL_ENTITLEMENT_NOT_ACTIVE";
  else if (!sellerWallet?.provenanceTracked)
    reasonCode = "CREDIT_PROVENANCE_REVIEW_REQUIRED";
  else if (sellerWallet.availableCredit < order.sellerNetCredit)
    reasonCode = "MATERIAL_REFUND_ADMIN_REQUIRED";
  return {
    canRefund: reasonCode === null,
    deadline,
    reasonCode,
    evaluatedAt,
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
    orderBy: [{ effectiveAt: "desc" }, { versionNo: "desc" }],
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
