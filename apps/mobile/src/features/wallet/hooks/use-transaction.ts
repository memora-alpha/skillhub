import { useCallback } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import { useQuery } from "@tanstack/react-query";
import { useOptionalWalletRuntime } from "../context/WalletProvider";
import {
  transactionOptions,
  projectTransaction,
} from "../utils/transaction-query";
import { validTransactionId } from "../schemas/transaction-contracts";

export function useTransaction(id: string) {
  const runtime = useOptionalWalletRuntime(),
    focused = useIsFocused();
  const options = transactionOptions(runtime, runtime?.client ?? null, id);
  const query = useQuery({ ...options, enabled: !!options.enabled && focused }),
    refetch = query.refetch;
  const refresh = useCallback(() => {
    if (
      focused &&
      validTransactionId(id) &&
      runtime?.capabilities.transaction &&
      runtime.isCurrent()
    )
      return refetch({ cancelRefetch: false });
  }, [focused, id, runtime, refetch]);
  useFocusEffect(
    useCallback(() => {
      const listener = AppState.addEventListener("change", (next) => {
        if (next === "active") void refresh();
      });
      const remove = () => listener.remove(),
        unregister = runtime?.addCleanup(remove);
      return () => {
        remove();
        unregister?.();
      };
    }, [runtime, refresh]),
  );
  return {
    valid: validTransactionId(id),
    state: projectTransaction(runtime, id, query),
    refresh,
  };
}
