import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PaginatedHttpClient } from "@/lib/http/client";
import type { WalletRuntime } from "../context/wallet-runtime";
import type {
  PaymentProjection,
  PaymentRefreshSnapshot,
} from "../types/payment";
import { createOwnerPaymentRefresh } from "../utils/payment-related-reads";

const unavailable: PaymentRefreshSnapshot = {
  wallet: { status: "unavailable", stale: false },
  history: { status: "unavailable", stale: false },
};
const noop = () => () => {};
export function useQaRelatedRefresh(
  runtime: (WalletRuntime & { client: PaginatedHttpClient }) | null,
  payment: PaymentProjection | undefined,
  active: boolean,
) {
  const queries = useQueryClient();
  const coordinator = useMemo(
    () =>
      runtime && payment
        ? createOwnerPaymentRefresh(runtime, queries, runtime.client, payment)
        : null,
    [runtime, queries, payment],
  );
  const state = useSyncExternalStore(
    coordinator?.subscribe ?? noop,
    coordinator?.getSnapshot ?? (() => unavailable),
    () => unavailable,
  );
  useEffect(() => {
    coordinator?.activate();
    if (active) void coordinator?.refresh();
    else coordinator?.pause();
    return () => coordinator?.dispose();
  }, [coordinator, active]);
  return {
    state,
    refresh: (name: "wallet" | "history") => {
      if (active) void coordinator?.refresh(name);
    },
  };
}
