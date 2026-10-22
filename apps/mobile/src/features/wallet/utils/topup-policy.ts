import { creditAmount, vndAmount } from "./amount";
import type { TopUpReview } from "../types/payment";

// BE currently accepts 1,000–2,000,000 VND in 1,000 VND steps. The app's
// create flow uses a 2,000 VND floor for bank minimums; keep BE validation
// separately so already-dispatched 1,000 VND requests can still be recovered
// or retried with their existing idempotency key.
export const topUpPolicy = Object.freeze({
  version: "2026-10-15-v1",
  minimum: "2000",
  contractMinimum: "1000",
  maximum: "2000000",
  step: "1000",
  vndPerCredit: "1000",
});
export const amountHint =
  "Nhập số nguyên từ 2.000 đến 2.000.000 VND, bội số 1.000; không dùng dấu phân cách.";
function validateAmount(text: string, minimum: bigint): TopUpReview {
  const amount = vndAmount(text);
  if (
    amount.length > 7 ||
    BigInt(amount) < minimum ||
    BigInt(amount) > 2000000n ||
    !amount.endsWith("000")
  )
    throw new TypeError(amountHint);
  return Object.freeze({
    amountVnd: amount,
    estimatedCredit: creditAmount(amount.slice(0, -3) + ".00"),
    method: "PAYOS",
    policyVersion: "2026-10-15-v1",
    provenance: "estimate",
  });
}
export function validateTopUp(text: string): TopUpReview {
  return validateAmount(text, BigInt(topUpPolicy.minimum));
}
export function validateContractTopUp(text: string): TopUpReview {
  return validateAmount(text, BigInt(topUpPolicy.contractMinimum));
}
