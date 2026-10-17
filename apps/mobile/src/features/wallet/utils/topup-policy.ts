import { creditAmount, vndAmount } from "./amount";
import type { QuoteModel, TopUpReview } from "../types/payment";

// Approved policy, mirrored from BE domain/top-up-policy.ts at 17e3ac1.
// No quote endpoint, local expiry, presets or authoritative Credit calculation.
export const topUpPolicy = Object.freeze({
  version: "2026-10-15-v1",
  minimum: "1000",
  maximum: "2000000",
  step: "1000",
  vndPerCredit: "1000",
});
export const amountHint =
  "Nhập số nguyên từ 1.000 đến 2.000.000 VND, bội số 1.000; không dùng dấu phân cách.";
export function validateTopUp(text: string): TopUpReview {
  const amount = vndAmount(text);
  if (
    amount.length > 7 ||
    BigInt(amount) < 1000n ||
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
export function reviewTopUp(text: string, quote?: QuoteModel): TopUpReview {
  const review = validateTopUp(text);
  if (!quote) return review;
  if (
    !quote.quoteId ||
    quote.amountVnd !== review.amountVnd ||
    creditAmount(quote.credit) !== review.estimatedCredit ||
    quote.policyVersion !== review.policyVersion ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(quote.expiresAt) ||
    !Number.isFinite(Date.parse(quote.expiresAt)) ||
    new Date(quote.expiresAt).toISOString() !== quote.expiresAt
  )
    throw new TypeError(
      "Thông tin xác nhận đã thay đổi. Vui lòng xem lại số tiền.",
    );
  return Object.freeze({
    ...review,
    provenance: "confirmed-model",
    quote: Object.freeze({ ...quote }),
  });
}
