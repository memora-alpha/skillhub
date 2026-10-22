import type { TopUpReview as AccountTopUpReview } from "../../src/features/wallet/types/payment";
import type {
  WalletScope,
  VndAmount,
  CreditAmount,
} from "../../src/features/wallet/types/wallet";
export type TopUpDraft = Readonly<{ amountText: string }>;
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
export type QuoteModel = Readonly<{
  quoteId: string;
  amountVnd: string;
  credit: string;
  policyVersion: string;
  expiresAt: string;
}>;
export type TopUpReview = Omit<AccountTopUpReview, "provenance"> & {
  provenance: "estimate" | "confirmed-model";
  quote?: QuoteModel;
};
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
