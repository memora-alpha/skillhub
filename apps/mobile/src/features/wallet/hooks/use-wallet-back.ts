import { useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { walletBack, type WalletView } from "../utils/navigation";

export function useWalletBack(view: WalletView, pending = false) {
  const router = useRouter();
  usePreventRemove(pending, () => {
    // Keep the current draft mounted; this guard never cancels financial work.
  });
  return () => walletBack(router, view, pending);
}
