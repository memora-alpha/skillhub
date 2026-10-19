import type { WalletScope } from "../types/wallet";
import { walletScopeKey } from "./wallet-query-keys";

export const paymentPolicyKey = (scope: WalletScope, environment: string) =>
  [
    ...walletScopeKey(scope),
    "payments",
    "creation-policy",
    environment,
  ] as const;

export const paymentDetailKey = (scope: WalletScope, id: string) =>
  [...walletScopeKey(scope), "payments", "detail", id] as const;
export const paymentListKey = (
  scope: WalletScope,
  status: string | undefined,
  chain: number,
) =>
  [
    ...walletScopeKey(scope),
    "payments",
    "list",
    status ?? null,
    chain,
  ] as const;
