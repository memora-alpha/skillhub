import { validateTopUp } from "../../src/features/wallet/utils/topup-policy";
import { creditAmount } from "../../src/features/wallet/utils/amount";
import type { QuoteModel, TopUpReview } from "./wallet-model-types";
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
