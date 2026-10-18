import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptionalWalletRuntime } from "../context/WalletProvider";
import {
  paymentReadOptions,
  projectPaymentRead,
  pausePaymentRead,
} from "../utils/payment-read-query";

export function usePaymentStatus(id: string) {
  const runtime = useOptionalWalletRuntime(),
    queries = useQueryClient(),
    focused = useIsFocused();
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background",
  );
  const active = useRef(false);
  active.current = focused && foreground;
  const options = paymentReadOptions(
    runtime,
    runtime?.client ?? null,
    id,
    queries,
  );
  const query = useQuery({
    ...options,
    enabled: !!options.enabled && focused && foreground,
  });
  const refetch = query.refetch;
  const check = useCallback(() => {
    if (active.current && options.enabled && runtime?.isCurrent())
      return refetch({ cancelRefetch: false });
  }, [refetch, runtime, options.enabled]);
  useFocusEffect(
    useCallback(() => {
      if (AppState.currentState !== "background") void check();
      const listener = AppState.addEventListener("change", (next) => {
        active.current = next === "active";
        setForeground(next === "active");
        if (next === "active") void check();
        else void pausePaymentRead(queries, runtime, id);
      });
      const remove = () => {
        active.current = false;
        listener.remove();
        void pausePaymentRead(queries, runtime, id);
      };
      const unregister = runtime?.addCleanup(remove);
      return () => {
        remove();
        unregister?.();
      };
    }, [runtime, queries, id, check]),
  );
  return {
    state: projectPaymentRead(runtime, id, query),
    check: options.enabled ? check : undefined,
  };
}
