import type { Page } from "@/lib/http/response";
import type { InfiniteData } from "@tanstack/react-query";
import type { CreditAmount, CreditDelta } from "./wallet";

export const transactionTypes = [
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
export type HistoryFilters = Readonly<{
  type?: (typeof transactionTypes)[number];
  referenceType?: (typeof referenceTypes)[number];
}>;
export type Transaction = Readonly<{
  id: string;
  operationId: string;
  type: string;
  status: string;
  amount: CreditAmount;
  availableDelta: CreditDelta;
  heldDelta: CreditDelta;
  availableAfter: CreditAmount;
  heldAfter: CreditAmount;
  referenceType: string;
  referenceId: string;
  reversesTransactionId: string | null;
  createdAt: string;
}>;
export type TransactionPage = Page<Transaction>;
export type HistoryData = InfiniteData<TransactionPage> & {
  denial?: "denied" | "not-found";
};
