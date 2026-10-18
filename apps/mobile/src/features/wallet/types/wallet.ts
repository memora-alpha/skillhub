export type CreditAmount = string & { readonly __unit: "credit-amount" };
export type CreditDelta = string & { readonly __unit: "credit-delta" };
export type VndAmount = string & { readonly __unit: "vnd-amount" };
export type WalletScope = Readonly<{ ownerId: string; generation: number }>;
export type WalletSnapshot = Readonly<{
  availableCredit: CreditAmount;
  heldCredit: CreditAmount;
  walletVersion: number;
}>;
export type WalletReadCapability =
  "wallet" | "history" | "transaction" | "paymentStatus";
export type WalletCapabilities = Readonly<
  Record<
    | WalletReadCapability
    | "quote"
    | "createPayment"
    | "paymentStatus"
    | "recovery",
    boolean
  >
>;
export type FinancialReadStatus =
  | "unavailable"
  | "loading"
  | "ready"
  | "empty"
  | "refreshing"
  | "refresh-error"
  | "error"
  | "denied"
  | "not-found"
  | "session-ended";
export type FinancialRead<T> = Readonly<{
  status: FinancialReadStatus;
  data?: T;
  stale: boolean;
}>;
