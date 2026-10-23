import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";
import { useFocusEffect, useIsFocused } from "expo-router";
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
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background",
  );
  const retries = useRef(0);
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
  }, [coordinator, focused, foreground]);
  useEffect(() => {
    retries.current = 0;
  }, [coordinator]);
  useEffect(() => {
    const failed = (["wallet", "history"] as const).filter(
      (name) => state[name].status === "error",
    );
    if (
      !coordinator ||
      !focused ||
      !foreground ||
      !failed.length ||
      retries.current >= 3
    )
      return;
    const timer = setTimeout(() => {
      if (AppState.currentState === "background" || !runtime?.isCurrent())
        return;
      retries.current++;
      for (const name of failed) void coordinator.refresh(name);
    }, 10000);
    return () => clearTimeout(timer);
  }, [
    coordinator,
    focused,
    foreground,
    runtime,
    state.wallet.status,
    state.history.status,
  ]);
  useFocusEffect(
    useCallback(() => {
      const listener = AppState.addEventListener("change", (next) => {
        setForeground(next === "active");
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
