import { ConflictException } from "@nestjs/common";

export const REDEMPTION_STATUSES = [
  "ISSUING",
  "ISSUED",
  "FAILED_REFUNDED",
  "MANUAL_REVIEW",
  "REFUNDED_MANUAL",
] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];

const transitions: Record<RedemptionStatus, readonly RedemptionStatus[]> = {
  ISSUING: ["ISSUED", "FAILED_REFUNDED", "MANUAL_REVIEW"],
  MANUAL_REVIEW: ["ISSUED", "REFUNDED_MANUAL"],
  ISSUED: [],
  FAILED_REFUNDED: [],
  REFUNDED_MANUAL: [],
};

export function assertTransition(from: RedemptionStatus, to: RedemptionStatus) {
  if (!transitions[from].includes(to))
    throw new ConflictException("VOUCHER_INVALID_TRANSITION");
}

/** Reconcile backoff: 1, 2, 4, ... minutes capped at 30. */
export function nextCheckDelayMs(attempts: number): number {
  return Math.min(2 ** Math.max(0, attempts), 30) * 60_000;
}

export type RedemptionLimits = {
  userDailyLimitCredit: bigint;
  platformDailyBudgetVnd: bigint;
};

/** Credit amounts are hundredths of a Credit (100 = 1 Credit). */
export function assertWithinLimits(input: {
  limits: RedemptionLimits;
  priceCredit: bigint;
  faceValueVnd: bigint;
  userSpentToday: bigint;
  platformIssuedVndToday: bigint;
}) {
  if (
    input.userSpentToday + input.priceCredit >
    input.limits.userDailyLimitCredit * 100n
  )
    throw new ConflictException("VOUCHER_USER_LIMIT_EXCEEDED");
  if (
    input.platformIssuedVndToday + input.faceValueVnd >
    input.limits.platformDailyBudgetVnd
  )
    throw new ConflictException("VOUCHER_BUDGET_EXCEEDED");
}
