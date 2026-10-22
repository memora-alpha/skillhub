import type { CreditAmount, VndAmount, FinancialRead } from "./wallet";

export type PaymentState =
  | "CREATED"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED"
  | "REVIEW"
  | "CANCELLED";
export type PaymentCheckout = Readonly<{
  providerStatus: "PENDING";
  paymentLinkId: string;
  orderCode: string;
  qrCode: string;
}>;
// Backend projection: no response owner/scope/quoteId or preparation intent.
export type PaymentProjection = Readonly<{
  id: string;
  gateway: string;
  status: string;
  paymentAmountVnd: VndAmount;
  currency: "VND";
  creditAmount: CreditAmount;
  conversionRateVndPerCredit: number;
  createdAt: string;
  expiresAt: string | null;
  paidAt: string | null;
  version: number;
  recoveryRequired: boolean;
  recoveryReason: string | null;
  checkout: PaymentCheckout | null;
}>;
export type PaymentCreationPolicy = Readonly<{
  canCreate: boolean;
  reasonCode: string | null;
  existingPaymentId: string | null;
}>;
export type PaymentObservationModel = Readonly<{
  paymentId: string;
  state: PaymentState | "UNKNOWN";
  amountVnd: VndAmount;
  credit: CreditAmount;
}>;
export type PaymentObservationRead = FinancialRead<PaymentObservationModel> &
  Readonly<{
    issue?: "conflict";
    recoveryReason?: string | null;
    recoveryRequired?: boolean;
  }>;
export type RelatedRead = Readonly<{
  status: "unavailable" | "idle" | "loading" | "success" | "error";
  stale: boolean;
}>;
export type PaymentRefreshSnapshot = Readonly<{
  payment?: PaymentObservationModel;
  wallet: RelatedRead;
  history: RelatedRead;
}>;

export type TopUpReview = Readonly<{
  amountVnd: VndAmount;
  estimatedCredit: CreditAmount;
  method: "PAYOS";
  policyVersion: "2026-10-15-v1";
  provenance: "estimate";
}>;
