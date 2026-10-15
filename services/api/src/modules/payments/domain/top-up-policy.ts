import { BadRequestException } from "@nestjs/common";
import { vndToCredit } from "../../credit/domain/money";

/** User-approved on 2026-10-15; persisted quotes must retain this policy snapshot. */
export const TOP_UP_POLICY = {
  version: "2026-10-15-v1",
  minimumVnd: 1_000n,
  maximumVnd: 2_000_000n,
  stepVnd: 1_000n,
  ttlMilliseconds: 60 * 60 * 1000,
} as const;

export function createTopUpQuote(paymentAmountVnd: bigint, now: Date) {
  if (
    paymentAmountVnd < TOP_UP_POLICY.minimumVnd ||
    paymentAmountVnd > TOP_UP_POLICY.maximumVnd ||
    paymentAmountVnd % TOP_UP_POLICY.stepVnd !== 0n ||
    !Number.isFinite(now.getTime())
  )
    throw new BadRequestException("INVALID_TOP_UP_AMOUNT_OR_TIME");
  return {
    paymentAmountVnd,
    creditUnits: vndToCredit(paymentAmountVnd),
    conversionRateVndPerCredit: 1000,
    policyVersion: TOP_UP_POLICY.version,
    expiresAt: new Date(now.getTime() + TOP_UP_POLICY.ttlMilliseconds),
  };
}
