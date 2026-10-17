import type {
  CreditAmount,
  VndAmount,
  WalletScope,
  FinancialRead,
} from "./wallet";

// Local presentation types only; no public Payment DTO is implemented yet.
export type PaymentState =
  "CREATED" | "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";
export type TopUpDraft = Readonly<{ amountText: string }>;
export type PaymentObservationModel = Readonly<{
  paymentId: string;
  state: PaymentState | "UNKNOWN";
  amountVnd: VndAmount;
  credit: CreditAmount;
}>;
// US3 injected-model boundary only, independent of US2 creation and HTTP DTOs.
export type PaymentModelTarget = Readonly<{
  scope: WalletScope;
  paymentId: string;
  amountVnd: VndAmount;
  credit: CreditAmount;
}>;
export type PaymentModelReader = (
  target: PaymentModelTarget,
  signal: AbortSignal,
) => Promise<unknown>;
export type PaymentObservationRead = FinancialRead<PaymentObservationModel> &
  Readonly<{ issue?: "conflict" }>;
export type RelatedRead = Readonly<{
  status: "unavailable" | "idle" | "loading" | "success" | "error";
  stale: boolean;
}>;
export type PaymentRefreshSnapshot = Readonly<{
  payment?: PaymentObservationModel;
  wallet: RelatedRead;
  history: RelatedRead;
}>;

// Inert preparation boundary only. These are NOT Payment HTTP DTOs or keys.
export type QuoteModel = Readonly<{
  quoteId: string;
  amountVnd: string;
  credit: string;
  policyVersion: string;
  expiresAt: string;
}>;
export type TopUpReview = Readonly<{
  amountVnd: VndAmount;
  estimatedCredit: CreditAmount;
  method: "PAYOS";
  policyVersion: "2026-10-15-v1";
  provenance: "estimate" | "confirmed-model";
  quote?: QuoteModel;
}>;
export type PaymentIntent = Readonly<{
  localId: string;
  scope: WalletScope;
  review: TopUpReview;
}>;
export type PreparationStage =
  | "DRAFT"
  | "REVIEW"
  | "CREATING"
  | "CREATED_WITH_ID"
  | "REJECTED_WITH_NO_CREATION"
  | "UNKNOWN_OUTCOME"
  | "SESSION_ENDED";
export type PreparationSnapshot = Readonly<{
  stage: PreparationStage;
  draft: TopUpDraft;
  review?: TopUpReview;
  intent?: PaymentIntent;
  paymentId?: string;
  error?: string;
}>;
export type ModelDispatch = (
  intent: PaymentIntent,
  options: Readonly<{
    signal: AbortSignal;
    retry: false;
    replayAfterRenewal: false;
  }>,
) => Promise<unknown>;
