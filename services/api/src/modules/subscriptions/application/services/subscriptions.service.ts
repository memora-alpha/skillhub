import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  SubscriptionPlanVersion,
  UserSubscription,
} from "../../../../generated/prisma/client";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import { fingerprintCommand } from "../../../../infrastructure/idempotency/idempotency.service";
import { IdempotencyService } from "../../../../infrastructure/idempotency/idempotency.service";
import {
  listBoundary,
  listInput,
  listResult,
} from "../../../../shared/http/list-page";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { CreditOperationsService } from "../../../credit/application/services/credit-operations.service";
import { formatCredit } from "../../../credit/domain/money";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import {
  PLAN_RANK,
  type SubscriptionPlanCode,
} from "../../domain/plan-entitlements";
import {
  grantsEntitlements,
  proratedUpgradeAmount,
  termEndFor,
  usagePeriod,
  type SubscriptionInterval,
} from "../../domain/subscription.policy";
import { materialStorageUsed } from "../../../materials/application/services/material-storage";
import { SubscriptionEntitlementsReader } from "./subscription-entitlements.reader";
import { SubscriptionPlansService } from "./subscription-plans.service";
import {
  auditContext,
  chargeView,
  databaseNow,
  humanActor,
  lockSubscriptionOwner,
  periodUsage,
  priceFor,
  requireSubscriptionPermission,
  savePeriodUsage,
  sha256,
  subscriptionAudit,
  subscriptionView,
  versionEntitlements,
} from "./subscription-support";

type CurrentRow = UserSubscription & { planVersion: SubscriptionPlanVersion };
type PendingCharge = { chargeId: string; operationId: string; amount: bigint };

function requireIdempotencyKey(value: string | undefined): string {
  const key = value?.trim();
  if (
    !key ||
    key.length < 8 ||
    key.length > 128 ||
    !/^[\x21-\x7e]+$/u.test(key)
  )
    throw new BadRequestException("IDEMPOTENCY_KEY_REQUIRED");
  return key;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly idempotency: IdempotencyService,
    private readonly credit: CreditOperationsService,
    private readonly audit: AuditWriter,
    private readonly configuration: SystemConfigurationService,
    private readonly plans: SubscriptionPlansService,
    private readonly entitlements: SubscriptionEntitlementsReader,
  ) {}

  /** Kill switch for sales (D-flag); paid terms keep their entitlements. */
  private async assertEnabled(tx: TransactionContext) {
    const snapshot = await this.configuration.getSnapshot(
      ["subscription.enabled"],
      tx,
    );
    if (!snapshot.values["subscription.enabled"])
      throw new ForbiddenException("SUBSCRIPTIONS_DISABLED");
  }

  /**
   * The user's ACTIVE or GRACE row while it still grants entitlements. A row whose term or
   * grace has lapsed is left to the renewal job, which owns every term-end transition
   * (renew, grace, expire) with its audit and events; until it runs, changes wait.
   */
  private async current(
    tx: TransactionContext,
    userId: string,
    now: Date,
  ): Promise<CurrentRow | null> {
    const row = await tx.userSubscription.findFirst({
      where: { userId, status: { in: ["ACTIVE", "GRACE"] } },
      include: { planVersion: true },
    });
    if (!row) return null;
    if (!grantsEntitlements(row, now))
      throw new ConflictException("SUBSCRIPTION_RENEWAL_PENDING");
    return row;
  }

  /** Debits Credit first, so a short balance fails before any subscription write. */
  private async debit(
    tx: TransactionContext,
    userId: string,
    amount: bigint,
  ): Promise<PendingCharge> {
    const chargeId = randomUUID();
    const { operationId } = await this.credit.chargeSubscription(tx, {
      chargeId,
      userId,
      amount,
    });
    return { chargeId, operationId, amount };
  }

  private async recordCharge(
    tx: TransactionContext,
    charge: PendingCharge,
    input: {
      subscriptionId: string;
      userId: string;
      kind: "PURCHASE" | "UPGRADE" | "RECORDING_ADDON";
      planVersionId: string;
      quantity?: number;
      key: string;
      command: Record<string, string>;
    },
  ) {
    await tx.subscriptionCharge.create({
      data: {
        id: charge.chargeId,
        subscriptionId: input.subscriptionId,
        userId: input.userId,
        kind: input.kind,
        planVersionId: input.planVersionId,
        amount: charge.amount,
        quantity: input.quantity ?? 1,
        operationId: charge.operationId,
        idempotencyKey: sha256(`${input.kind}:${input.key}`),
        requestDigest: fingerprintCommand(input.command),
      },
    });
  }

  async purchase(
    principal: Principal,
    input: {
      planCode: SubscriptionPlanCode;
      interval: SubscriptionInterval;
      expectedPlanVersionId: string;
    },
    idempotencyKey: string | undefined,
  ) {
    requireSubscriptionPermission(principal, "subscription:manage:self");
    const key = requireIdempotencyKey(idempotencyKey);
    const command = {
      planCode: input.planCode,
      interval: input.interval,
      expectedPlanVersionId: input.expectedPlanVersionId,
    };
    await this.idempotency.execute(
      {
        scope: `subscription:${principal.userId}`,
        operation: "purchase",
        key,
        command,
        conflictMessage: "IDEMPOTENCY_KEY_REUSED",
      },
      async (tx) => {
        await this.assertEnabled(tx);
        await lockSubscriptionOwner(tx, principal.userId);
        const now = await databaseNow(tx);
        if (await this.current(tx, principal.userId, now))
          throw new ConflictException("SUBSCRIPTION_ALREADY_ACTIVE");
        const version = await this.plans.effectiveVersion(
          tx,
          input.planCode,
          now,
        );
        if (!version)
          throw new NotFoundException("SUBSCRIPTION_PLAN_NOT_FOUND");
        if (version.id !== input.expectedPlanVersionId)
          throw new ConflictException("SUBSCRIPTION_PLAN_CHANGED");
        const charge = await this.debit(
          tx,
          principal.userId,
          priceFor(version, input.interval),
        );
        const subscription = await tx.userSubscription.create({
          data: {
            userId: principal.userId,
            planCode: input.planCode,
            planVersionId: version.id,
            interval: input.interval,
            status: "ACTIVE",
            autoRenew: true,
            termStart: now,
            termEnd: termEndFor(now, input.interval),
            nextRenewalAttemptAt: termEndFor(now, input.interval),
          },
        });
        await this.recordCharge(tx, charge, {
          subscriptionId: subscription.id,
          userId: principal.userId,
          kind: "PURCHASE",
          planVersionId: version.id,
          key,
          command,
        });
        await this.audit.append(tx, {
          actor: humanActor(principal),
          action: "SUBSCRIPTION_PURCHASE",
          target: { type: "USER_SUBSCRIPTION", id: subscription.id },
          after: subscriptionAudit(subscription, charge),
          reason: "Subscription purchase",
          context: auditContext(),
        });
        return { id: subscription.id, status: subscription.status };
      },
    );
    return this.me(principal);
  }

  async upgradeQuote(principal: Principal, planCode: SubscriptionPlanCode) {
    requireSubscriptionPermission(principal, "subscription:manage:self");
    return this.transactions.run(async (tx) => {
      await this.assertEnabled(tx);
      const now = await databaseNow(tx);
      const quote = await this.quote(tx, principal.userId, planCode, now);
      return {
        planCode,
        planVersionId: quote.target.id,
        amount: formatCredit(quote.amount),
        termEnd: quote.row.termEnd.toISOString(),
        quotedAt: now.toISOString(),
        version: quote.row.version,
      };
    });
  }

  /** D7: prorated difference for the rest of the current term, same interval. */
  private async quote(
    tx: TransactionContext,
    userId: string,
    planCode: SubscriptionPlanCode,
    now: Date,
  ) {
    const row = await this.current(tx, userId, now);
    if (row?.status !== "ACTIVE")
      throw new ConflictException("SUBSCRIPTION_NOT_ACTIVE");
    if (PLAN_RANK[planCode] <= PLAN_RANK[row.planCode])
      throw new ConflictException("SUBSCRIPTION_NOT_AN_UPGRADE");
    const target = await this.plans.effectiveVersion(tx, planCode, now);
    if (!target) throw new NotFoundException("SUBSCRIPTION_PLAN_NOT_FOUND");
    const currentPrice = priceFor(row.planVersion, row.interval);
    const targetPrice = priceFor(target, row.interval);
    if (targetPrice <= currentPrice)
      throw new ConflictException("SUBSCRIPTION_NOT_AN_UPGRADE");
    const amount = proratedUpgradeAmount({
      currentPrice,
      targetPrice,
      termStart: row.termStart,
      termEnd: row.termEnd,
      at: now,
    });
    return { row, target, amount };
  }

  async upgrade(
    principal: Principal,
    input: {
      planCode: SubscriptionPlanCode;
      expectedPlanVersionId: string;
      expectedAmount: bigint;
      expectedVersion: number;
    },
    idempotencyKey: string | undefined,
  ) {
    requireSubscriptionPermission(principal, "subscription:manage:self");
    const key = requireIdempotencyKey(idempotencyKey);
    const command = {
      planCode: input.planCode,
      expectedPlanVersionId: input.expectedPlanVersionId,
      expectedAmount: input.expectedAmount.toString(),
      expectedVersion: String(input.expectedVersion),
    };
    await this.idempotency.execute(
      {
        scope: `subscription:${principal.userId}`,
        operation: "upgrade",
        key,
        command,
        conflictMessage: "IDEMPOTENCY_KEY_REUSED",
      },
      async (tx) => {
        await this.assertEnabled(tx);
        await lockSubscriptionOwner(tx, principal.userId);
        const now = await databaseNow(tx);
        const { row, target, amount } = await this.quote(
          tx,
          principal.userId,
          input.planCode,
          now,
        );
        if (row.version !== input.expectedVersion)
          throw new ConflictException("SUBSCRIPTION_VERSION_CONFLICT");
        if (
          target.id !== input.expectedPlanVersionId ||
          amount !== input.expectedAmount
        )
          throw new ConflictException("SUBSCRIPTION_QUOTE_CHANGED");
        // The last seconds of a term can floor the price to 0: upgrade without a charge.
        const charge =
          amount > 0n ? await this.debit(tx, principal.userId, amount) : null;
        const updated = await tx.userSubscription.update({
          where: { id: row.id },
          data: {
            planCode: input.planCode,
            planVersionId: target.id,
            // An explicit upgrade supersedes a pending downgrade.
            scheduledPlanCode: null,
            version: { increment: 1 },
          },
        });
        await this.raisePeriodAllowance(tx, row, target, now);
        if (charge)
          await this.recordCharge(tx, charge, {
            subscriptionId: row.id,
            userId: principal.userId,
            kind: "UPGRADE",
            planVersionId: target.id,
            key,
            command,
          });
        await this.audit.append(tx, {
          actor: humanActor(principal),
          action: "SUBSCRIPTION_UPGRADE",
          target: { type: "USER_SUBSCRIPTION", id: row.id },
          before: subscriptionAudit(row, null),
          after: subscriptionAudit(updated, charge),
          reason: "Subscription upgrade",
          context: auditContext(),
        });
        return { id: row.id, status: updated.status };
      },
    );
    return this.me(principal);
  }

  /**
   * An upgrade is paid for the rest of the term, so the current period's recording allowance
   * rises to the new plan at once; minutes already used stay used. A period without a stored
   * row needs nothing: it starts from the subscription's (now upgraded) plan version. Downgrades
   * apply at renewal, so an allowance never decreases inside a period.
   */
  private async raisePeriodAllowance(
    tx: TransactionContext,
    row: UserSubscription,
    target: SubscriptionPlanVersion,
    now: Date,
  ) {
    const allowed = versionEntitlements(target).recordingMinutesPerPeriod;
    const period = usagePeriod(row.termStart, row.termEnd, now);
    await tx.subscriptionUsage.updateMany({
      where: {
        subscriptionId: row.id,
        periodStart: period.start,
        recordingMinutesAllowed: { lt: allowed },
      },
      data: { recordingMinutesAllowed: allowed },
    });
  }

  /**
   * PATCH semantics: `undefined` keeps a value, `null` clears a scheduled change.
   * Scheduled changes apply at renewal; an upgrade must use the upgrade route.
   */
  async update(
    principal: Principal,
    input: {
      expectedVersion: number;
      autoRenew?: boolean;
      scheduledPlanCode?: SubscriptionPlanCode | null;
      scheduledInterval?: SubscriptionInterval | null;
    },
  ) {
    requireSubscriptionPermission(principal, "subscription:manage:self");
    // No kill-switch check: a paying user must always be able to stop renewal.
    await this.transactions.run(async (tx) => {
      await lockSubscriptionOwner(tx, principal.userId);
      const now = await databaseNow(tx);
      const row = await this.current(tx, principal.userId, now);
      if (!row) throw new NotFoundException("SUBSCRIPTION_NOT_FOUND");
      if (row.version !== input.expectedVersion)
        throw new ConflictException("SUBSCRIPTION_VERSION_CONFLICT");
      const planCode = this.scheduledPlan(row, input.scheduledPlanCode);
      const interval = this.scheduledIntervalFor(row, input.scheduledInterval);
      const updated = await tx.userSubscription.update({
        where: { id: row.id },
        data: {
          autoRenew: input.autoRenew,
          scheduledPlanCode: planCode,
          scheduledInterval: interval,
          version: { increment: 1 },
        },
      });
      await this.audit.append(tx, {
        actor: humanActor(principal),
        action: "SUBSCRIPTION_UPDATE",
        target: { type: "USER_SUBSCRIPTION", id: row.id },
        before: subscriptionAudit(row, null),
        after: subscriptionAudit(updated, null),
        reason: "Subscription settings change",
        context: auditContext(),
      });
    });
    return this.me(principal);
  }

  private scheduledPlan(
    row: UserSubscription,
    requested: SubscriptionPlanCode | null | undefined,
  ): SubscriptionPlanCode | null | undefined {
    if (requested === undefined || requested === null) return requested;
    if (PLAN_RANK[requested] > PLAN_RANK[row.planCode])
      throw new ConflictException("USE_UPGRADE_ENDPOINT");
    // Scheduling the current plan is the same as clearing the change.
    return requested === row.planCode ? null : requested;
  }

  private scheduledIntervalFor(
    row: UserSubscription,
    requested: SubscriptionInterval | null | undefined,
  ): SubscriptionInterval | null | undefined {
    if (requested === undefined || requested === null) return requested;
    return requested === row.interval ? null : requested;
  }

  /**
   * Spec 021 D14: add-on recording minutes for the current term, sold only on a plan that
   * allows them. The price comes from `subscription.recordingAddon`; the client confirms
   * the per-pack price it showed, so a price change between display and payment is refused.
   */
  async buyRecordingMinutes(
    principal: Principal,
    input: { packs: number; expectedPriceCredit: number },
    idempotencyKey: string | undefined,
  ) {
    requireSubscriptionPermission(principal, "subscription:manage:self");
    const key = requireIdempotencyKey(idempotencyKey);
    if (!Number.isInteger(input.packs) || input.packs < 1 || input.packs > 10)
      throw new BadRequestException("RECORDING_ADDON_PACKS_INVALID");
    const command = {
      packs: String(input.packs),
      expectedPriceCredit: String(input.expectedPriceCredit),
    };
    await this.idempotency.execute(
      {
        scope: `subscription:${principal.userId}`,
        operation: "recording-addon",
        key,
        command,
        conflictMessage: "IDEMPOTENCY_KEY_REUSED",
      },
      async (tx) => {
        await this.assertEnabled(tx);
        await lockSubscriptionOwner(tx, principal.userId);
        const now = await databaseNow(tx);
        const row = await this.current(tx, principal.userId, now);
        if (!row || !versionEntitlements(row.planVersion).recordingAddonAllowed)
          throw new ConflictException("RECORDING_ADDON_NOT_ALLOWED");
        const { values } = await this.configuration.getSnapshot(
          ["subscription.recordingAddon"],
          tx,
        );
        const addon = values["subscription.recordingAddon"];
        if (addon.priceCredit !== input.expectedPriceCredit)
          throw new ConflictException("RECORDING_ADDON_PRICE_CHANGED");
        const minutes = addon.minutes * input.packs;
        const charge = await this.debit(
          tx,
          principal.userId,
          // Config prices are whole Credit; amounts are hundredths.
          BigInt(addon.priceCredit) * BigInt(input.packs) * 100n,
        );
        const usage = await periodUsage(tx, row, now);
        const addonMinutesRemaining = usage.addonMinutesRemaining + minutes;
        await savePeriodUsage(tx, row.id, { ...usage, addonMinutesRemaining });
        await this.recordCharge(tx, charge, {
          subscriptionId: row.id,
          userId: principal.userId,
          kind: "RECORDING_ADDON",
          planVersionId: row.planVersionId,
          quantity: input.packs,
          key,
          command,
        });
        await this.audit.append(tx, {
          actor: humanActor(principal),
          action: "SUBSCRIPTION_RECORDING_ADDON",
          target: { type: "USER_SUBSCRIPTION", id: row.id },
          after: {
            planCode: row.planCode,
            packs: input.packs,
            minutes,
            addonMinutesRemaining,
            chargeAmount: charge.amount.toString(),
            operationId: charge.operationId,
          },
          reason: "Recording add-on purchase",
          context: auditContext(),
        });
        return { id: row.id, status: row.status };
      },
    );
    return (await this.me(principal)).usage;
  }

  async me(principal: Principal) {
    requireSubscriptionPermission(principal, "subscription:manage:self");
    return this.transactions.run(async (tx) => {
      const now = await databaseNow(tx);
      const row = await tx.userSubscription.findFirst({
        where: {
          userId: principal.userId,
          status: { in: ["ACTIVE", "GRACE"] },
        },
      });
      const current = row && grantsEntitlements(row, now) ? row : null;
      const effective = await this.entitlements.forUser(
        tx,
        principal.userId,
        now,
      );
      return {
        subscription: current ? subscriptionView(current) : null,
        entitlements: effective.entitlements,
        usage: current ? await this.usage(tx, current, now, effective) : null,
        materialStorage: await this.materialStorage(
          tx,
          principal.userId,
          now,
          effective.entitlements.materialStorageBytes,
        ),
      };
    });
  }

  /** Spec 021 D9: storage for every user, Free included; `enforced` follows the flag. */
  private async materialStorage(
    tx: TransactionContext,
    userId: string,
    now: Date,
    allowedBytes: string,
  ) {
    const enforced =
      (await this.entitlements.materialStorageAllowance(tx, userId, now)) !==
      null;
    return {
      usedBytes: (await materialStorageUsed(tx, userId)).toString(),
      allowedBytes,
      enforced,
    };
  }

  private async usage(
    tx: TransactionContext,
    row: UserSubscription,
    now: Date,
    effective: Awaited<ReturnType<SubscriptionEntitlementsReader["forUser"]>>,
  ) {
    const period = usagePeriod(row.termStart, row.termEnd, now);
    const stored = await tx.subscriptionUsage.findUnique({
      where: {
        subscriptionId_periodStart: {
          subscriptionId: row.id,
          periodStart: period.start,
        },
      },
    });
    return {
      periodStart: period.start.toISOString(),
      periodEnd: period.end.toISOString(),
      recordingMinutesAllowed:
        stored?.recordingMinutesAllowed ??
        effective.entitlements.recordingMinutesPerPeriod,
      recordingMinutesUsed: stored?.recordingMinutesUsed ?? 0,
      addonMinutesRemaining: stored?.addonMinutesRemaining ?? 0,
    };
  }

  async charges(
    principal: Principal,
    query: { limit?: number; cursor?: string },
  ) {
    requireSubscriptionPermission(principal, "subscription:manage:self");
    return this.chargePage(principal.userId, query, "subscription-charges");
  }

  private async chargePage(
    userId: string,
    query: { limit?: number; cursor?: string },
    scope: string,
  ) {
    const { limit, cursor } = listInput(query, scope);
    const rows = await this.transactions.run((tx) =>
      tx.subscriptionCharge.findMany({
        where: { userId, ...listBoundary("createdAt", cursor) },
        include: { planVersion: { select: { planCode: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      }),
    );
    const page = listResult(rows, limit, scope, (row) => row.createdAt);
    return { data: page.data.map(chargeView), pagination: page.pagination };
  }

  async adminList(
    principal: Principal,
    query: {
      status?: UserSubscription["status"];
      planCode?: SubscriptionPlanCode;
      userId?: string;
      limit?: number;
      cursor?: string;
    },
  ) {
    requireSubscriptionPermission(principal, "subscription:read");
    const scope = "admin-subscriptions";
    const { limit, cursor } = listInput(query, scope);
    const rows = await this.transactions.run((tx) =>
      tx.userSubscription.findMany({
        where: {
          status: query.status,
          planCode: query.planCode,
          userId: query.userId,
          ...listBoundary("createdAt", cursor),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      }),
    );
    const page = listResult(rows, limit, scope, (row) => row.createdAt);
    return {
      data: page.data.map((row) => ({
        ...subscriptionView(row),
        userId: row.userId,
      })),
      pagination: page.pagination,
    };
  }

  async adminUser(principal: Principal, userId: string) {
    requireSubscriptionPermission(principal, "subscription:read");
    const [current, charges] = await Promise.all([
      this.transactions.run(async (tx) => {
        const now = await databaseNow(tx);
        const subscriptions = await tx.userSubscription.findMany({
          where: { userId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 50,
        });
        const live = subscriptions.find(
          (row) =>
            (row.status === "ACTIVE" || row.status === "GRACE") &&
            grantsEntitlements(row, now),
        );
        const effective = await this.entitlements.forUser(tx, userId, now);
        return {
          subscriptions,
          entitlements: effective.entitlements,
          usage: live ? await this.usage(tx, live, now, effective) : null,
          materialStorage: await this.materialStorage(
            tx,
            userId,
            now,
            effective.entitlements.materialStorageBytes,
          ),
        };
      }),
      this.chargePage(userId, { limit: 50 }, "admin-subscription-charges"),
    ]);
    return {
      userId,
      subscriptions: current.subscriptions.map(subscriptionView),
      entitlements: current.entitlements,
      usage: current.usage,
      materialStorage: current.materialStorage,
      charges: charges.data,
    };
  }
}
