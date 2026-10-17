// Synthetic test models only. Payment values are not a public HTTP contract.
export const walletOwners = {
  a: "10000000-0000-4000-8000-000000000001",
  b: "10000000-0000-4000-8000-000000000002",
  zero: "10000000-0000-4000-8000-000000000003",
  absent: "10000000-0000-4000-8000-000000000004",
} as const;
export const walletModels = {
  a: { availableCredit: "123.45", heldCredit: "20.00", walletVersion: 7 },
  b: { availableCredit: "7.00", heldCredit: "0.00", walletVersion: 2 },
  zero: { availableCredit: "0.00", heldCredit: "0.00", walletVersion: 0 },
  absent: { availableCredit: "0.00", heldCredit: "0.00", walletVersion: 0 },
} as const;
export const exactCreditExamples = [
  "0.00",
  "0.01",
  "12.34",
  "9007199254740993.01",
] as const;
export const malformedCreditExamples: readonly unknown[] = [
  12.34,
  null,
  undefined,
  "",
  "1",
  "1.2",
  "1.234",
  "01.00",
  "+1.00",
  "1e3",
  "NaN",
  "Infinity",
  " 1.00",
  "1.00\n",
];
export const paymentModelStates = [
  "CREATED",
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "UNFAMILIAR",
] as const;
export const syntheticQr = "SKILLHUB:TEST-ONLY:NOT-A-PAYMENT\nQR payload ✓";
export const ledgerTypes = [
  "TOP_UP",
  "DAILY_BONUS",
  "FEEDBACK_BONUS",
  "HOLD",
  "RELEASE",
  "PATH_RETURN",
  "PLATFORM_FEE",
  "TEACHING_PAYMENT",
  "TEACHING_EARNING",
  "MATERIAL_PURCHASE",
  "MATERIAL_SALE",
  "REFUND",
  "PENALTY",
  "ADJUSTMENT",
] as const;
export const referenceTypes = [
  "PAYMENT",
  "LEARNING_PATH",
  "SESSION",
  "REVIEW",
  "DISPUTE",
  "MATERIAL_ORDER",
  "SYSTEM",
] as const;
export const ledgerStates = [
  "PENDING",
  "SUCCESS",
  "FAILED",
  "REVERSED",
] as const;
export function ledgerModel(sequence: number) {
  const id = `20000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
  const hold = sequence % ledgerTypes.length === 3;
  return {
    id,
    operationId: `30000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    type: ledgerTypes[sequence % ledgerTypes.length],
    amount: "100.00",
    availableDelta: hold ? "-100.00" : "0.00",
    heldDelta: hold ? "100.00" : "-100.00",
    availableAfter: "123.45",
    heldAfter: "20.00",
    status: ledgerStates[sequence % ledgerStates.length],
    referenceType: referenceTypes[sequence % referenceTypes.length],
    referenceId: `synthetic-reference-${sequence}`,
    reversesTransactionId:
      sequence === 220 ? "20000000-0000-4000-8000-000000000001" : null,
    // Ties deliberately differ from the private committed sequence ordering.
    createdAt: "2026-10-15T10:00:00.000Z",
  };
}
