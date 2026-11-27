import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type {
  SubscriptionCharge,
  SubscriptionPlanVersion,
  UserSubscription,
} from "../../../../generated/prisma/client";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { PermissionCode } from "../../../../shared/authorization/permission.catalog";
import { roleCodes } from "../../../../shared/authorization/principal-actor";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { formatCredit } from "../../../credit/domain/money";
import {
  parsePlanEntitlements,
  type PlanEntitlements,
} from "../../domain/plan-entitlements";
import {
  usagePeriod,
  type SubscriptionInterval,
} from "../../domain/subscription.policy";

export function requireSubscriptionPermission(
  principal: Principal,
  code: PermissionCode,
) {
  if (!principal.permissions.includes(code))
    throw new ForbiddenException("SUBSCRIPTION_PERMISSION_REQUIRED");
}

export function humanActor(principal: Principal) {
  return {
    kind: "HUMAN" as const,
    userId: principal.userId,
    roles: roleCodes(principal),
  };
}

export function auditContext() {
  return { requestId: randomUUID(), correlationId: randomUUID() };
}

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** Database time, so every check in one transaction uses the same clock. */
export async function databaseNow(tx: TransactionContext): Promise<Date> {
  const [clock] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT CURRENT_TIMESTAMP AS now`;
  if (!(clock?.now instanceof Date))
    throw new ServiceUnavailableException("DATABASE_TIME_UNAVAILABLE");
  return clock.now;
}

/**
 * Serializes one user's subscription changes. Lock order (plan.md): this lock, then the
 * wallet lock taken by the Credit charge.
 */
export async function lockSubscriptionOwner(
  tx: TransactionContext,
  userId: string,
): Promise<void> {
  await lockKey(tx, `subscription-owner:${userId}`);
}

/** Transaction-scoped advisory lock; same form as fee-policy-admin and material favorites. */
export async function lockKey(
  tx: TransactionContext,
  key: string,
): Promise<void> {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

export function priceFor(
  version: Pick<SubscriptionPlanVersion, "monthPrice" | "yearPrice">,
  interval: SubscriptionInterval,
): bigint {
  return interval === "MONTH" ? version.monthPrice : version.yearPrice;
}

export function versionEntitlements(
  version: Pick<SubscriptionPlanVersion, "entitlements">,
): PlanEntitlements {
  try {
    return parsePlanEntitlements(version.entitlements);
  } catch {
    // A stored approved version is validated on creation; failing here means data drift.
    throw new ConflictException("SUBSCRIPTION_PLAN_INVALID");
  }
}

export function planVersionView(version: SubscriptionPlanVersion) {
  return {
    planCode: version.planCode,
    planVersionId: version.id,
    versionNo: version.versionNo,
    monthPrice: formatCredit(version.monthPrice),
    yearPrice: formatCredit(version.yearPrice),
    entitlements: versionEntitlements(version),
    effectiveAt: version.effectiveAt?.toISOString() ?? null,
  };
}

export function adminPlanVersionView(version: SubscriptionPlanVersion) {
  return {
    ...planVersionView(version),
    status: version.status,
    approvedAt: version.approvedAt?.toISOString() ?? null,
    approvedByUserId: version.approvedByUserId,
    createdByUserId: version.createdByUserId,
    createdAt: version.createdAt.toISOString(),
  };
}

export function subscriptionView(row: UserSubscription) {
  return {
    id: row.id,
    planCode: row.planCode,
    planVersionId: row.planVersionId,
    interval: row.interval,
    status: row.status,
    autoRenew: row.autoRenew,
    termStart: row.termStart.toISOString(),
    termEnd: row.termEnd.toISOString(),
    graceUntil: row.graceUntil?.toISOString() ?? null,
    scheduledPlanCode: row.scheduledPlanCode,
    scheduledInterval: row.scheduledInterval,
    version: row.version,
  };
}

export function chargeView(
  row: SubscriptionCharge & { planVersion: { planCode: string } },
) {
  return {
    id: row.id,
    kind: row.kind,
    planCode: row.planVersion.planCode,
    amount: formatCredit(row.amount),
    quantity: row.quantity,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Audit projection of a subscription after a change (audit catalog `subscription`). */
export function subscriptionAudit(
  row: UserSubscription,
  charge: { amount: bigint; operationId: string } | null,
) {
  return {
    planCode: row.planCode,
    planVersionId: row.planVersionId,
    interval: row.interval,
    status: row.status,
    autoRenew: row.autoRenew,
    termEnd: row.termEnd.toISOString(),
    scheduledPlanCode: row.scheduledPlanCode,
    scheduledInterval: row.scheduledInterval,
    version: row.version,
    chargeAmount: charge ? charge.amount.toString() : null,
    operationId: charge?.operationId ?? null,
  };
}

export function planAudit(version: SubscriptionPlanVersion) {
  return {
    planCode: version.planCode,
    versionNo: version.versionNo,
    status: version.status,
    monthPrice: version.monthPrice.toString(),
    yearPrice: version.yearPrice.toString(),
    effectiveAt: version.effectiveAt?.toISOString() ?? null,
  };
}

type UsageSubscription = UserSubscription & {
  planVersion: Pick<SubscriptionPlanVersion, "entitlements">;
};

export type UsageValues = {
  periodStart: Date;
  recordingMinutesAllowed: number;
  recordingMinutesUsed: number;
  addonMinutesRemaining: number;
};

/**
 * Usage for the period containing `at`. During GRACE, `at` is past `termEnd`; usage then
 * stays in the term's last period, so grace never opens a fresh allowance.
 */
function usageInstant(row: UserSubscription, at: Date): Date {
  return at.getTime() >= row.termEnd.getTime()
    ? new Date(row.termEnd.getTime() - 1)
    : at;
}

/**
 * Spec 021 data model: the stored row for the period, or the values it would start with.
 * A new period snapshots the plan allowance and carries the add-on minutes left from the
 * latest earlier period of the same term; add-on minutes expire with the term.
 */
export async function periodUsage(
  tx: TransactionContext,
  row: UsageSubscription,
  at: Date,
): Promise<UsageValues & { stored: boolean }> {
  const period = usagePeriod(row.termStart, row.termEnd, usageInstant(row, at));
  const stored = await tx.subscriptionUsage.findUnique({
    where: {
      subscriptionId_periodStart: {
        subscriptionId: row.id,
        periodStart: period.start,
      },
    },
  });
  if (stored) return { ...stored, stored: true };
  const previous = await tx.subscriptionUsage.findFirst({
    where: {
      subscriptionId: row.id,
      periodStart: { gte: row.termStart, lt: period.start },
    },
    orderBy: { periodStart: "desc" },
  });
  return {
    periodStart: period.start,
    recordingMinutesAllowed: versionEntitlements(row.planVersion)
      .recordingMinutesPerPeriod,
    recordingMinutesUsed: 0,
    addonMinutesRemaining: previous?.addonMinutesRemaining ?? 0,
    stored: false,
  };
}

/** Writes the period row; the caller holds the subscription owner lock. */
export async function savePeriodUsage(
  tx: TransactionContext,
  subscriptionId: string,
  usage: UsageValues & { stored: boolean },
): Promise<void> {
  const values = {
    recordingMinutesAllowed: usage.recordingMinutesAllowed,
    recordingMinutesUsed: usage.recordingMinutesUsed,
    addonMinutesRemaining: usage.addonMinutesRemaining,
  };
  if (usage.stored)
    await tx.subscriptionUsage.update({
      where: {
        subscriptionId_periodStart: {
          subscriptionId,
          periodStart: usage.periodStart,
        },
      },
      data: values,
    });
  else
    await tx.subscriptionUsage.create({
      data: { subscriptionId, periodStart: usage.periodStart, ...values },
    });
}

/** Minutes a requester can still record: period allowance left plus add-on minutes. */
export function remainingRecordingMinutes(usage: UsageValues): number {
  return (
    Math.max(0, usage.recordingMinutesAllowed - usage.recordingMinutesUsed) +
    usage.addonMinutesRemaining
  );
}
