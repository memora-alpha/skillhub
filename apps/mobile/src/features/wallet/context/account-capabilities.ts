import { noWalletCapabilities } from "./wallet-runtime";

// Ordinary native routes use verified durable correlation. Web remains read-only.
export function accountWalletCapabilities(platform: string) {
  const native = platform === "ios" || platform === "android";
  return {
    ...noWalletCapabilities,
    wallet: true,
    history: true,
    transaction: true,
    paymentStatus: true,
    createPayment: native,
    recovery: native,
  };
}
