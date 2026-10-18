import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useOptionalWalletRuntime } from "../context/WalletProvider";
import { createOwnerPaymentRefresh } from "../utils/payment-related-reads";
import type {
  PaymentProjection,
  PaymentRefreshSnapshot,
} from "../types/payment";

const unavailable: PaymentRefreshSnapshot = {
  wallet: { status: "unavailable", stale: false },
  history: { status: "unavailable", stale: false },
};
const noop = () => () => {};
export function usePaymentReadRefresh(payment?: PaymentProjection) {
  const runtime = useOptionalWalletRuntime(),
    queries = useQueryClient(),
    focused = useIsFocused();
  const coordinator = useMemo(
    () =>
      runtime?.capabilities.paymentStatus && payment
        ? createOwnerPaymentRefresh(runtime, queries, runtime.client, payment)
        : undefined,
    [runtime, queries, payment],
  );
  const state = useSyncExternalStore(
    coordinator?.subscribe ?? noop,
    coordinator?.getSnapshot ?? (() => unavailable),
    () => unavailable,
  );
  useEffect(() => {
    coordinator?.activate();
    if (coordinator && focused && AppState.currentState !== "background")
      void coordinator.refresh();
    return () => coordinator?.dispose();
  }, [coordinator, focused]);
  useFocusEffect(
    useCallback(() => {
      const listener = AppState.addEventListener("change", (next) => {
        if (next !== "active") coordinator?.pause();
      });
      return () => {
        listener.remove();
        coordinator?.pause();
      };
    }, [coordinator]),
  );
  return {
    state,
    refresh: (name: "wallet" | "history") => {
      if (focused && AppState.currentState !== "background")
        void coordinator?.refresh(name);
    },
  };
}
