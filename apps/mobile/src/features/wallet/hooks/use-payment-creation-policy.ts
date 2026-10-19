import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptionalWalletRuntime } from "../context/WalletProvider";
import {
  paymentPolicyOptions,
  projectPaymentPolicy,
} from "../utils/payment-policy-query";
import { getApiUrl } from "@/config/env";
import { useCallback, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";

export function usePaymentCreationPolicy() {
  const runtime = useOptionalWalletRuntime(),
    queries = useQueryClient();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background",
  );
  const options = useMemo(
    () =>
      paymentPolicyOptions(
        runtime,
        runtime?.client ?? null,
        queries,
        getApiUrl(),
      ),
    [runtime, queries],
  );
  const query = useQuery({
    ...options,
    enabled: !!options.enabled && focused && foreground,
  });
  useFocusEffect(
    useCallback(() => {
      const pause = () => {
        void queries.cancelQueries({ queryKey: options.queryKey, exact: true });
      };
      const listener = AppState.addEventListener("change", (next) => {
        setForeground(next === "active");
        if (next !== "active") pause();
      });
      return () => {
        listener.remove();
        pause();
      };
    }, [queries, options]),
  );
  return {
    state: projectPaymentPolicy(
      runtime,
      query.data,
      query.error,
      query.isFetching,
    ),
    check: () =>
      options.enabled &&
      focused &&
      foreground &&
      query.refetch({ cancelRefetch: false }),
  };
}
