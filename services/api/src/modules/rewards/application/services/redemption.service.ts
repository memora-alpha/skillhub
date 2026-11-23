import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import type {
  IssuedVoucher,
  RewardBrand,
  RewardProduct,
  VoucherRedemption,
} from "../../../../generated/prisma/client";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import { IdempotencyService } from "../../../../infrastructure/idempotency/idempotency.service";
import {
  listBoundary,
  listInput,
  listResult,
} from "../../../../shared/http/list-page";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { CreditOperationsService } from "../../../credit/application/services/credit-operations.service";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import { formatCredit } from "../../../credit/domain/money";
import {
  assertTransition,
  assertWithinLimits,
  nextCheckDelayMs,
} from "../../domain/redemption.policy";
import {
  VoucherProviderError,
  type IssuedVoucherData,
} from "../contracts/voucher-provider";
import { VoucherProvider } from "../ports/voucher-provider";
import {
  auditContext,
  humanActor,
  requireReward,
  vietnamDayStart,
} from "./reward-support";
import { VoucherSecretCipher } from "./voucher-secret.cipher";

const ISSUE_TIMEOUT_MS = 10_000;
/** Statuses whose face value counts against budgets (refunded ones do not). */
const COUNTED = ["ISSUING", "ISSUED", "MANUAL_REVIEW"] as const;

type LockedRow = VoucherRedemption & {
  product: RewardProduct & { brand: RewardBrand };
};

type RedemptionRow = VoucherRedemption & {
  product: RewardProduct & { brand: RewardBrand };
  voucher: IssuedVoucher | null;
};

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new VoucherProviderError("UNKNOWN", "PROVIDER_TIMEOUT")),
      ms,
    );
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

function requireIdempotencyKey(value: string | undefined): string {
  const key = value?.trim();
  if (!key || key.length > 128 || !/^[\x21-\x7e]+$/u.test(key))
    throw new BadRequestException("IDEMPOTENCY_KEY_REQUIRED");
  return key;
}

/** Idempotency identity of a redeem request; the raw key is hashed before storage. */
function redeemIdentity(principal: Principal, key: string) {
  return {
    scope: `voucher-redeem:${principal.userId}`,
    operation: "redeem",
    key: createHash("sha256").update(key).digest("hex"),
  };
}

function errorCode(error: unknown): string {
  return error instanceof VoucherProviderError
    ? error.code
    : "PROVIDER_UNEXPECTED_ERROR";
}

@Injectable()
export class RedemptionService {
  private readonly logger = new Logger(RedemptionService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly idempotency: IdempotencyService,
    private readonly credit: CreditOperationsService,
    private readonly audit: AuditWriter,
    private readonly provider: VoucherProvider,
    private readonly cipher: VoucherSecretCipher,
    private readonly configuration: SystemConfigurationService,
    private readonly config: ConfigService,
  ) {}

  enabled(): boolean {
    return this.config.get("VOUCHER_REDEMPTION_ENABLED") === true;
  }

  private assertEnabled() {
    if (!this.enabled())
      throw new ForbiddenException("VOUCHER_REDEMPTION_DISABLED");
  }

  async redeem(
    principal: Principal,
    input: { productId: string; expectedPriceVersion: number },
    idempotencyKey: string | undefined,
  ) {
    this.assertEnabled();
    requireReward(principal, "reward:redeem");
    const key = requireIdempotencyKey(idempotencyKey);
    const result = await this.idempotency.execute(
      {
        ...redeemIdentity(principal, key),
        command: {
          productId: input.productId,
          expectedPriceVersion: input.expectedPriceVersion,
        },
        conflictMessage: "IDEMPOTENCY_KEY_REUSED",
      },
      (tx) => this.debit(tx, principal, input, key),
    );
    if (!result.replayed) await this.issue(result.value.id);
    return this.get(principal, result.value.id, { reveal: false });
  }

  /**
   * Status of a redeem request by its Idempotency-Key, owner only. Waits for a request still
   * running with that key. If none committed, the key is retired so a delayed request with it
   * can no longer debit; NOT_FOUND therefore means the request will never take effect.
   */
  async lookup(principal: Principal, idempotencyKey: string | undefined) {
    this.assertEnabled();
    requireReward(principal, "reward:redeem");
    const key = requireIdempotencyKey(idempotencyKey);
    const id = await this.transactions.run(
      async (tx) => {
        await this.idempotency.retire(tx, redeemIdentity(principal, key));
        const row = await tx.voucherRedemption.findUnique({
          where: {
            userId_idempotencyKey: {
              userId: principal.userId,
              idempotencyKey: key,
            },
          },
          select: { id: true },
        });
        return row?.id;
      },
      // Each statement sees rows committed while the INSERT waited on an in-flight request.
      { isolationLevel: "ReadCommitted" },
    );
    if (!id) throw new NotFoundException("VOUCHER_REDEMPTION_NOT_FOUND");
    return this.get(principal, id, { reveal: false });
  }

  /** Tx1: validate, debit Credit (any source, oldest lot first), record the ISSUING redemption. */
  private async debit(
    tx: TransactionContext,
    principal: Principal,
    input: { productId: string; expectedPriceVersion: number },
    key: string,
  ) {
    // FOR SHARE keeps admin price edits (FOR UPDATE) out until this debit commits.
    await tx.$queryRaw`SELECT id FROM reward_products WHERE id = ${input.productId}::uuid FOR SHARE`;
    const product = await tx.rewardProduct.findUnique({
      where: { id: input.productId },
      include: { brand: true },
    });
    if (
      product?.status !== "ACTIVE" ||
      product.brand.status !== "ACTIVE" ||
      product.priceCredit === null
    )
      throw new ConflictException("REWARD_NOT_AVAILABLE");
    if (product.priceVersion !== input.expectedPriceVersion)
      throw new ConflictException("REWARD_PRICE_CHANGED");
    // The wallet lock serializes this user's limit check; the advisory lock does the same for the budget.
    await this.credit.lockWallet(tx, principal.userId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('voucher-budget'))`;
    const snapshot = await this.configuration.getSnapshot(
      ["voucher.userDailyLimitCredit", "voucher.platformDailyBudgetVnd"],
      tx,
    );
    const since = vietnamDayStart();
    const [user, platform] = await Promise.all([
      tx.voucherRedemption.aggregate({
        _sum: { priceCredit: true },
        where: {
          userId: principal.userId,
          createdAt: { gte: since },
          status: { in: [...COUNTED] },
        },
      }),
      tx.voucherRedemption.aggregate({
        _sum: { faceValueVnd: true },
        where: { createdAt: { gte: since }, status: { in: [...COUNTED] } },
      }),
    ]);
    assertWithinLimits({
      limits: {
        userDailyLimitCredit: BigInt(
          snapshot.values["voucher.userDailyLimitCredit"],
        ),
        platformDailyBudgetVnd: BigInt(
          snapshot.values["voucher.platformDailyBudgetVnd"],
        ),
      },
      priceCredit: product.priceCredit,
      faceValueVnd: product.faceValueVnd,
      userSpentToday: user._sum.priceCredit ?? 0n,
      platformIssuedVndToday: platform._sum.faceValueVnd ?? 0n,
    });
    const id = randomUUID();
    const { operationId, lots } = await this.credit.redeemVoucher(tx, {
      redemptionId: id,
      userId: principal.userId,
      amount: product.priceCredit,
    });
    await tx.voucherRedemption.create({
      data: {
        id,
        userId: principal.userId,
        productId: product.id,
        priceCredit: product.priceCredit,
        priceVersion: product.priceVersion,
        faceValueVnd: product.faceValueVnd,
        provider: this.provider.name,
        status: "ISSUING",
        idempotencyKey: key,
        debitOperationId: operationId,
        nextCheckAt: new Date(Date.now() + 60_000),
      },
    });
    await tx.voucherRedemptionLot.createMany({
      data: lots.map((lot) => ({
        redemptionId: id,
        lotId: lot.lotId,
        amount: lot.amount,
      })),
    });
    await this.audit.append(tx, {
      actor: humanActor(principal),
      action: "VOUCHER_REDEEM",
      target: { type: "VOUCHER_REDEMPTION", id },
      after: {
        productId: product.id,
        priceCredit: product.priceCredit.toString(),
        status: "ISSUING",
        operationId,
      },
      reason: "Voucher redemption",
      context: auditContext(),
    });
    return { id, status: "ISSUING" };
  }

  /** Provider call runs outside any transaction; every outcome finalizes idempotently. */
  async issue(redemptionId: string): Promise<void> {
    const row = await this.db.voucherRedemption.findUnique({
      where: { id: redemptionId },
      include: { product: true },
    });
    if (row?.status !== "ISSUING") return;
    try {
      const data = await withTimeout(
        this.provider.issue({
          clientRef: row.id,
          providerProductId: row.product.providerProductId,
          faceValueVnd: row.faceValueVnd,
        }),
        ISSUE_TIMEOUT_MS,
      );
      await this.finalizeIssued(row.id, data);
    } catch (error) {
      if (error instanceof VoucherProviderError && error.kind === "DEFINITIVE")
        await this.failDefinitive(row.id, error.code);
      else await this.recordUnknown(row.id, errorCode(error));
    }
  }

  async finalizeIssued(id: string, data: IssuedVoucherData): Promise<void> {
    await this.transactions.run(async (tx) => {
      const row = await this.lockRow(tx, id);
      if (row.status !== "ISSUING" && row.status !== "MANUAL_REVIEW") return;
      await this.applyIssued(tx, row, data);
    });
  }

  /** Only a DEFINITIVE provider failure refunds automatically. */
  async failDefinitive(id: string, code: string): Promise<void> {
    await this.transactions.run(async (tx) => {
      const row = await this.lockRow(tx, id);
      if (row.status !== "ISSUING") return;
      await this.applyRefund(tx, row, "FAILED_REFUNDED", {
        lastErrorCode: code,
        nextCheckAt: null,
      });
    });
  }

  /** Store the sealed voucher and mark ISSUED. Caller holds the row lock. */
  private async applyIssued(
    tx: TransactionContext,
    row: LockedRow,
    data: IssuedVoucherData,
  ) {
    assertTransition(row.status, "ISSUED");
    const sealed = this.cipher.seal(row.id, {
      code: data.code,
      pin: data.pin,
      link: data.link,
    });
    await tx.issuedVoucher.create({
      data: {
        redemptionId: row.id,
        snapshot: {
          brandName: row.product.brand.nameVi,
          brandLogoUrl: row.product.brand.logoUrl,
          productName: row.product.displayNameOverride ?? row.product.nameVi,
          imageUrl: row.product.imageOverride ?? row.product.imageUrl,
          faceValueVnd: row.faceValueVnd.toString(),
          terms: row.product.termsVi,
        },
        secretCiphertext: sealed.ciphertext,
        secretIv: sealed.iv,
        secretTag: sealed.tag,
        keyVersion: sealed.keyVersion,
        expiresAt: data.expiresAt,
      },
    });
    return tx.voucherRedemption.update({
      where: { id: row.id },
      data: {
        status: "ISSUED",
        providerTransactionRef: data.providerTransactionRef,
        lastErrorCode: null,
        nextCheckAt: null,
        resolvedAt: new Date(),
      },
    });
  }

  /** Return the debited Credit to its lots and close the redemption. Caller holds the row lock. */
  private async applyRefund(
    tx: TransactionContext,
    row: LockedRow,
    status: "FAILED_REFUNDED" | "REFUNDED_MANUAL",
    extra: { lastErrorCode?: string; nextCheckAt?: null } = {},
  ) {
    assertTransition(row.status, status);
    const { operationId } = await this.credit.refundVoucher(tx, {
      redemptionId: row.id,
      userId: row.userId,
      amount: row.priceCredit,
      spentLots: await this.spentLots(tx, row.id),
    });
    return tx.voucherRedemption.update({
      where: { id: row.id },
      data: {
        ...extra,
        status,
        refundOperationId: operationId,
        resolvedAt: new Date(),
      },
    });
  }

  /** Unknown outcome: keep the debit, back off, and escalate after the attempt budget. */
  async recordUnknown(id: string, code: string): Promise<void> {
    await this.transactions.run(async (tx) => {
      const row = await this.lockRow(tx, id);
      if (row.status !== "ISSUING") return;
      const { values } = await this.configuration.getSnapshot(
        ["voucher.reconcileMaxAttempts"],
        tx,
      );
      const attempts = row.attempts + 1;
      const exhausted = attempts >= values["voucher.reconcileMaxAttempts"];
      if (exhausted) assertTransition(row.status, "MANUAL_REVIEW");
      await tx.voucherRedemption.update({
        where: { id },
        data: {
          attempts,
          lastErrorCode: code,
          status: exhausted ? "MANUAL_REVIEW" : "ISSUING",
          nextCheckAt: exhausted
            ? null
            : new Date(Date.now() + nextCheckDelayMs(attempts)),
        },
      });
      if (exhausted)
        this.logger.warn(`VOUCHER_MANUAL_REVIEW redemption=${id} code=${code}`);
    });
  }

  /** Claim due ISSUING rows (SKIP LOCKED) and ask the provider what happened. */
  async reconcileDue(limit = 20): Promise<number> {
    const ids = await this.transactions.run(async (tx) => {
      const due = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM voucher_redemptions
        WHERE status = 'ISSUING' AND next_check_at <= now()
        ORDER BY next_check_at LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
      if (due.length)
        await tx.voucherRedemption.updateMany({
          where: { id: { in: due.map((row) => row.id) } },
          data: { nextCheckAt: new Date(Date.now() + 2 * 60_000) },
        });
      return due.map((row) => row.id);
    });
    // Sequential on purpose: each id makes a provider call plus its own transaction, so
    // running the batch in parallel would burst provider requests and DB connections.
    for (const id of ids) await this.reconcileOne(id);
    return ids.length;
  }

  private async reconcileOne(id: string): Promise<void> {
    try {
      const found = await withTimeout(
        this.provider.findByClientRef(id),
        ISSUE_TIMEOUT_MS,
      );
      // No record is not proof nothing was issued; never auto-refund (spec 018 D6).
      if (found) await this.finalizeIssued(id, found);
      else await this.recordUnknown(id, "PROVIDER_RECORD_NOT_FOUND");
    } catch (error) {
      await this.recordUnknown(id, errorCode(error));
    }
  }

  private spentLots(tx: TransactionContext, redemptionId: string) {
    return tx.voucherRedemptionLot.findMany({
      where: { redemptionId },
      select: { lotId: true, amount: true },
      orderBy: { lotId: "asc" },
    });
  }

  private async lockRow(tx: TransactionContext, id: string) {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM voucher_redemptions WHERE id = ${id}::uuid FOR UPDATE`;
    if (!locked.length)
      throw new NotFoundException("VOUCHER_REDEMPTION_NOT_FOUND");
    return tx.voucherRedemption.findUniqueOrThrow({
      where: { id },
      include: { product: { include: { brand: true } } },
    });
  }

  private view(row: RedemptionRow) {
    const snapshot = row.voucher?.snapshot as Record<string, unknown> | null;
    return {
      id: row.id,
      status: row.status,
      priceCredit: formatCredit(row.priceCredit),
      faceValueVnd: row.faceValueVnd.toString(),
      product: {
        id: row.product.id,
        name:
          (snapshot?.productName as string | undefined) ??
          row.product.displayNameOverride ??
          row.product.nameVi,
        imageUrl:
          (snapshot?.imageUrl as string | null | undefined) ??
          row.product.imageOverride ??
          row.product.imageUrl,
        brandName:
          (snapshot?.brandName as string | undefined) ??
          row.product.brand.nameVi,
        brandLogoUrl:
          (snapshot?.brandLogoUrl as string | null | undefined) ??
          row.product.brand.logoUrl,
      },
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      expiresAt: row.voucher?.expiresAt?.toISOString() ?? null,
    };
  }

  async list(principal: Principal, query: { limit?: number; cursor?: string }) {
    requireReward(principal, "reward:redeem");
    const scope = `rewards:redemptions:${principal.userId}`;
    const { limit, cursor } = listInput(query, scope);
    const rows = await this.db.voucherRedemption.findMany({
      where: { userId: principal.userId, ...listBoundary("createdAt", cursor) },
      include: { product: { include: { brand: true } }, voucher: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = listResult(rows, limit, scope, (row) => row.createdAt);
    return {
      data: page.data.map((row) => this.view(row)),
      pagination: page.pagination,
    };
  }

  /** Owner-only. Revealing a voucher secret is audited. */
  async get(principal: Principal, id: string, options?: { reveal?: boolean }) {
    requireReward(principal, "reward:redeem");
    const row = await this.db.voucherRedemption.findFirst({
      where: { id, userId: principal.userId },
      include: { product: { include: { brand: true } }, voucher: true },
    });
    if (!row) throw new NotFoundException("VOUCHER_REDEMPTION_NOT_FOUND");
    const view = this.view(row);
    if (options?.reveal === false || !row.voucher)
      return { ...view, voucher: null };
    const secret = this.cipher.open(id, {
      ciphertext: row.voucher.secretCiphertext,
      iv: row.voucher.secretIv,
      tag: row.voucher.secretTag,
    });
    await this.transactions.run((tx) =>
      this.audit.append(tx, {
        actor: humanActor(principal),
        action: "VOUCHER_REVEAL",
        target: { type: "VOUCHER_REDEMPTION", id },
        after: {
          productId: row.productId,
          priceCredit: row.priceCredit.toString(),
          status: row.status,
          operationId: row.debitOperationId,
        },
        reason: "Owner revealed voucher",
        context: auditContext(),
      }),
    );
    return { ...view, voucher: secret };
  }

  async adminList(
    principal: Principal,
    query: {
      limit?: number;
      cursor?: string;
      status?: string;
      userId?: string;
      productId?: string;
    },
  ) {
    requireReward(principal, "reward:manage");
    const scope = "admin-rewards:redemptions";
    const { limit, cursor } = listInput(query, scope);
    const statuses = [
      "ISSUING",
      "ISSUED",
      "FAILED_REFUNDED",
      "MANUAL_REVIEW",
      "REFUNDED_MANUAL",
    ] as const;
    const status = statuses.find((value) => value === query.status);
    const rows = await this.db.voucherRedemption.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.productId ? { productId: query.productId } : {}),
        ...listBoundary("createdAt", cursor),
      },
      include: { product: { include: { brand: true } }, voucher: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = listResult(rows, limit, scope, (row) => row.createdAt);
    return {
      data: page.data.map((row) => ({
        ...this.view(row),
        userId: row.userId,
        provider: row.provider,
        attempts: row.attempts,
        lastErrorCode: row.lastErrorCode,
        debitOperationId: row.debitOperationId,
        refundOperationId: row.refundOperationId,
      })),
      pagination: page.pagination,
    };
  }

  /**
   * Resolve a MANUAL_REVIEW redemption: attach the voucher or refund. The state change, any
   * Credit refund and the mandatory audit commit together, so a failed audit leaves the
   * redemption in MANUAL_REVIEW and the admin can retry.
   */
  async resolve(
    principal: Principal,
    id: string,
    input: {
      action: "ISSUED" | "REFUND";
      reason: string;
      voucher?: {
        code?: string | null;
        pin?: string | null;
        link?: string | null;
        expiresAt?: Date | null;
      };
    },
  ) {
    requireReward(principal, "reward:manage");
    const reason = input.reason.trim();
    if (!reason) throw new BadRequestException("REASON_REQUIRED");
    if (
      input.action === "ISSUED" &&
      !(input.voucher?.code || input.voucher?.link)
    )
      throw new BadRequestException("VOUCHER_DATA_REQUIRED");
    return this.transactions.run(async (tx) => {
      const row = await this.lockRow(tx, id);
      if (row.status !== "MANUAL_REVIEW")
        throw new ConflictException("VOUCHER_INVALID_TRANSITION");
      const updated =
        input.action === "ISSUED"
          ? await this.applyIssued(tx, row, {
              providerTransactionRef: `manual-${id}`,
              code: input.voucher?.code ?? null,
              pin: input.voucher?.pin ?? null,
              link: input.voucher?.link ?? null,
              expiresAt: input.voucher?.expiresAt ?? null,
            })
          : await this.applyRefund(tx, row, "REFUNDED_MANUAL");
      await this.audit.append(tx, {
        actor: humanActor(principal),
        action: "VOUCHER_RESOLVE",
        target: { type: "VOUCHER_REDEMPTION", id },
        after: {
          productId: updated.productId,
          priceCredit: updated.priceCredit.toString(),
          status: updated.status,
          operationId: updated.refundOperationId ?? updated.debitOperationId,
        },
        reason,
        context: auditContext(),
      });
      return { id, status: updated.status };
    });
  }

  async budget(principal: Principal) {
    requireReward(principal, "reward:manage");
    const since = vietnamDayStart();
    const [issued, snapshot] = await Promise.all([
      this.db.voucherRedemption.aggregate({
        _sum: { faceValueVnd: true, priceCredit: true },
        _count: true,
        where: { createdAt: { gte: since }, status: { in: [...COUNTED] } },
      }),
      this.configuration.getSnapshot([
        "voucher.platformDailyBudgetVnd",
        "voucher.userDailyLimitCredit",
      ]),
    ]);
    return {
      dayStart: since.toISOString(),
      issuedCount: issued._count,
      issuedFaceValueVnd: (issued._sum.faceValueVnd ?? 0n).toString(),
      creditSpent: formatCredit(issued._sum.priceCredit ?? 0n),
      platformDailyBudgetVnd: String(
        snapshot.values["voucher.platformDailyBudgetVnd"],
      ),
      userDailyLimitCredit: String(
        snapshot.values["voucher.userDailyLimitCredit"],
      ),
    };
  }
}
