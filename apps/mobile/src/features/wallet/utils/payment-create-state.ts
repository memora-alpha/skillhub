import type {
  PaymentCreationPolicy,
  PaymentProjection,
  TopUpReview,
} from "../types/payment";
import type { WalletScope } from "../types/wallet";
import type { CorrelationStore } from "../storage/correlation-store-core";
import type {
  CreatePaymentBody,
  PaymentIdentity,
  RecoveryRecord,
} from "./payment-recovery-record";
import type { PaymentLiveObservation } from "./payment-observation";

export type PaymentCreateSnapshot = Readonly<{
  stage:
    | "loading"
    | "draft"
    | "review"
    | "claiming"
    | "unknown"
    | "known"
    | "blocked"
    | "ended";
  draft: string;
  busy: boolean;
  canReplay?: boolean;
  canReturnToDraft?: boolean;
  canStartNext?: boolean;
  canRestore?: boolean;
  readDenied?: boolean;
  readTargetId?: string;
  review?: TopUpReview;
  paymentId?: string;
  payment?: PaymentProjection;
  observation?: PaymentLiveObservation;
  policy?: PaymentCreationPolicy;
  notice?: string;
}>;
export type PaymentCoordinatorOptions = {
  identity: PaymentIdentity;
  scope: WalletScope;
  current: () => boolean;
  openStore: () => Promise<CorrelationStore>;
  newKey: () => string;
  api: {
    creationPolicy: (signal: AbortSignal) => Promise<unknown>;
    create: (
      body: CreatePaymentBody,
      key: string,
      signal: AbortSignal,
    ) => Promise<unknown>;
    detail: (id: string, signal: AbortSignal) => Promise<unknown>;
  };
};
export type PaymentCreatePrivate = {
  record?: RecoveryRecord;
  store?: CorrelationStore;
  storeVerified: boolean;
  incident: boolean;
};
