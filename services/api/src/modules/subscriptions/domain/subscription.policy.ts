export const DAY_MS = 86_400_000;
/** Spec 021 D4: usage allowances reset every 30 days inside a term. */
export const USAGE_PERIOD_MS = 30 * DAY_MS;

export const SUBSCRIPTION_INTERVALS = ["MONTH", "YEAR"] as const;
export type SubscriptionInterval = (typeof SUBSCRIPTION_INTERVALS)[number];

export const TERM_MS: Record<SubscriptionInterval, number> = {
  MONTH: 30 * DAY_MS,
  YEAR: 365 * DAY_MS,
};

export type SubscriptionStatus = "ACTIVE" | "GRACE" | "EXPIRED";

export function termEndFor(start: Date, interval: SubscriptionInterval): Date {
  return new Date(start.getTime() + TERM_MS[interval]);
}

/**
 * Start and end of the usage period containing `at`. The last period of a YEAR term
 * is shorter (5 days) and ends with the term.
 */
export function usagePeriod(
  termStart: Date,
  termEnd: Date,
  at: Date,
): { start: Date; end: Date } {
  const elapsed = Math.max(0, at.getTime() - termStart.getTime());
  const index = Math.floor(elapsed / USAGE_PERIOD_MS);
  const start = new Date(termStart.getTime() + index * USAGE_PERIOD_MS);
  const end = new Date(
    Math.min(start.getTime() + USAGE_PERIOD_MS, termEnd.getTime()),
  );
  return { start, end };
}

/**
 * Whether a stored subscription grants entitlements at `at`. A term that has ended
 * without renewal counts as expired even before the renewal job runs; GRACE keeps
 * entitlements until `graceUntil` (spec 021 D6).
 */
export function grantsEntitlements(
  subscription: {
    status: SubscriptionStatus;
    termEnd: Date;
    graceUntil: Date | null;
  },
  at: Date,
): boolean {
  if (subscription.status === "ACTIVE")
    return subscription.termEnd.getTime() > at.getTime();
  if (subscription.status === "GRACE")
    return (
      subscription.graceUntil !== null &&
      subscription.graceUntil.getTime() > at.getTime()
    );
  return false;
}

/**
 * Spec 021 D7: prorated upgrade price in Credit hundredths, floored.
 * Returns 0 when the term has already ended.
 */
export function proratedUpgradeAmount(input: {
  currentPrice: bigint;
  targetPrice: bigint;
  termStart: Date;
  termEnd: Date;
  at: Date;
}): bigint {
  if (input.targetPrice <= input.currentPrice)
    throw new RangeError("an upgrade must cost more than the current plan");
  const termMs = BigInt(input.termEnd.getTime() - input.termStart.getTime());
  if (termMs <= 0n)
    throw new RangeError("the term must have a positive length");
  const remaining = BigInt(
    Math.max(0, input.termEnd.getTime() - input.at.getTime()),
  );
  const bounded = remaining > termMs ? termMs : remaining;
  return ((input.targetPrice - input.currentPrice) * bounded) / termMs;
}

export type TermEndDecision =
  | { action: "RENEW" }
  | { action: "EXPIRE" }
  | { action: "ENTER_GRACE"; graceUntil: Date }
  | { action: "WAIT" };

/**
 * Spec 021 D6: what the renewal job does with a subscription whose term has ended.
 * `canPay` is evaluated against the wallet inside the renewal transaction.
 */
export function decideAtTermEnd(input: {
  status: SubscriptionStatus;
  autoRenew: boolean;
  canPay: boolean;
  termEnd: Date;
  graceUntil: Date | null;
  graceDays: number;
  at: Date;
}): TermEndDecision {
  if (input.status === "EXPIRED") return { action: "WAIT" };
  if (input.termEnd.getTime() > input.at.getTime()) return { action: "WAIT" };
  // A grace period that has run out ends the plan, even if the wallet was topped up later.
  if (input.status === "GRACE" && graceElapsed(input.graceUntil, input.at))
    return { action: "EXPIRE" };
  if (!input.autoRenew) return { action: "EXPIRE" };
  if (input.canPay) return { action: "RENEW" };
  if (input.status === "ACTIVE") {
    if (input.graceDays <= 0) return { action: "EXPIRE" };
    return {
      action: "ENTER_GRACE",
      graceUntil: new Date(input.termEnd.getTime() + input.graceDays * DAY_MS),
    };
  }
  return graceElapsed(input.graceUntil, input.at)
    ? { action: "EXPIRE" }
    : { action: "WAIT" };
}

/** A GRACE row without a deadline counts as elapsed. */
export function graceElapsed(graceUntil: Date | null, at: Date): boolean {
  return (graceUntil?.getTime() ?? 0) <= at.getTime();
}

/** Spec 021 D11: minutes charged for a finished recording, rounded up. */
export function recordedMinutes(durationMs: bigint | number): number {
  const ms = typeof durationMs === "bigint" ? Number(durationMs) : durationMs;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / 60_000);
}

/**
 * Splits recorded minutes into the period allowance first, then add-on minutes.
 * Minutes beyond both are absorbed by the platform and not carried over (D11).
 */
export function allocateRecordingMinutes(input: {
  minutes: number;
  allowed: number;
  used: number;
  addonRemaining: number;
}): { fromAllowance: number; fromAddon: number; absorbed: number } {
  const allowanceLeft = Math.max(0, input.allowed - input.used);
  const fromAllowance = Math.min(input.minutes, allowanceLeft);
  const fromAddon = Math.min(
    input.minutes - fromAllowance,
    Math.max(0, input.addonRemaining),
  );
  return {
    fromAllowance,
    fromAddon,
    absorbed: input.minutes - fromAllowance - fromAddon,
  };
}

// Fee policy codes are owned by the credit module (spec 021 D8).
export {
  baseFeePolicyCode,
  tierFeePolicyCode,
  type BaseFeePolicyCode,
} from "../../credit/domain/fee-policy-codes";
