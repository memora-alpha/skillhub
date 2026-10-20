/** Only these historical reviews were caused by checkout transport failures. */
export const technicalReviewReasons = [
  "PAYMENT_QR_UNAVAILABLE",
  "PAYMENT_PROVIDER_RETRY_EXHAUSTED",
] as const;

export function isTechnicalReviewReason(reason: string | null) {
  return (technicalReviewReasons as readonly (string | null)[]).includes(
    reason,
  );
}
