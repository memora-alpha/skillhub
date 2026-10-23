import { useCallback } from "react";
import { AppState } from "react-native";
import { useFocusEffect, useIsFocused } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useOptionalWalletRuntime } from "../context/WalletProvider";
import { projectWalletRead, walletReadOptions } from "../utils/wallet-query";

export function useWallet() {
  const runtime = useOptionalWalletRuntime();
  const focused = useIsFocused();
  const options = walletReadOptions(runtime, runtime?.client ?? null);
  // Retained Home/screens must not keep a financial query active in preview.
  const query = useQuery({ ...options, enabled: !!options.enabled && focused });
  const refetch = query.refetch;
  const refresh = useCallback(() => {
    if (focused && runtime?.capabilities.wallet && runtime.isCurrent())
      return refetch({ cancelRefetch: false });
  }, [focused, runtime, refetch]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const listener = AppState.addEventListener("change", (next) => {
        if (next === "active") void refresh();
      });
      const remove = () => listener.remove();
      const unregister = runtime?.addCleanup(remove);
      return () => {
        remove();
        unregister?.();
      };
    }, [refresh, runtime]),
  );
  // One query/cache projection is shared by every consumer; no shadow balance.
  return { state: projectWalletRead(runtime, query), refresh };
}
