export type WalletView =
  "wallet" | "topup" | "payment" | "status" | "history" | "transaction";
const fallbacks = {
  wallet: "/profile",
  topup: "/wallet",
  payment: "/wallet/topup",
  status: "/wallet",
  history: "/wallet",
  transaction: "/wallet/history",
} as const;
export const walletFallback = (view: WalletView) => fallbacks[view];
export function walletBack(
  router: {
    canGoBack: () => boolean;
    back: () => void;
    replace: (href: ReturnType<typeof walletFallback>) => void;
  },
  view: WalletView,
  pending = false,
) {
  if (pending) return;
  if (router.canGoBack()) router.back();
  else router.replace(walletFallback(view));
}
