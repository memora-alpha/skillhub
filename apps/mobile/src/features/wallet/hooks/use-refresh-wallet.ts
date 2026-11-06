import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOptionalWalletRuntime } from "../context/WalletProvider";

// External financial flows invalidate reads; they never write a client balance.
export function useRefreshWallet() {
  const runtime = useOptionalWalletRuntime();
  const cache = useQueryClient();
  return useCallback(() => {
    if (!runtime?.isCurrent()) return;
    return cache.invalidateQueries({ queryKey: runtime.key });
  }, [runtime, cache]);
}
