import type { WalletScope } from "../types/wallet";

export const walletScopeKey = (scope: WalletScope) =>
  ["wallet", scope.ownerId, scope.generation] as const;
export const walletQueryKey = (
  scope: WalletScope,
  ...selection: readonly unknown[]
) => [...walletScopeKey(scope), ...selection] as const;
