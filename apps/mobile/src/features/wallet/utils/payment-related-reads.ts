import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { PaginatedHttpClient } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import type { WalletRuntime } from "../context/wallet-runtime";
import type { PaymentProjection } from "../types/payment";
import type { HistoryFilters } from "../types/transaction";
import { walletReadOptions } from "./wallet-query";
import { historyOptions } from "./history-query";
import { createPaymentRefresh } from "./payment-refresh";
import { paymentState } from "./payment-outcome";

export function paymentModel(payment: PaymentProjection) {
  return Object.freeze({
    paymentId: payment.id,
    state: paymentState(payment.status),
    amountVnd: payment.paymentAmountVnd,
    credit: payment.creditAmount,
  });
}
export function createOwnerPaymentRefresh(
  runtime: WalletRuntime,
  queries: QueryClient,
  client: Pick<PaginatedHttpClient, "request" | "requestPage">,
  payment: PaymentProjection,
) {
  const guarded = async <T>(
    key: QueryKey,
    signal: AbortSignal,
    load: () => Promise<T>,
  ) => {
    if (!runtime.isCurrent() || signal.aborted) throw new AppError("session");
    // A request begun before PAID may still contain the old balance/snapshot.
    // Retire it before fetching; Query would otherwise coalesce with that read.
    if (queries.getQueryState(key)?.fetchStatus === "fetching") {
      await queries.cancelQueries({ queryKey: key, exact: true });
      if (!runtime.isCurrent() || signal.aborted) throw new AppError("session");
    }
    const cancel = () => {
      void queries.cancelQueries({ queryKey: key, exact: true });
    };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      const data = await load();
      if (!runtime.isCurrent() || signal.aborted) throw new AppError("session");
      return data;
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  };
  const refresh = createPaymentRefresh({
    payment: paymentModel(payment),
    current: runtime.isCurrent,
    reads: {
      ...(runtime.capabilities.wallet
        ? {
            wallet: async (signal: AbortSignal) => {
              const options = walletReadOptions(runtime, client);
              const data = await guarded(options.queryKey, signal, () =>
                queries.fetchQuery({ ...options, staleTime: 0 }),
              );
              if (data.kind !== "snapshot") throw new AppError("http", 403);
            },
          }
        : {}),
      ...(runtime.capabilities.history
        ? {
            history: async (signal: AbortSignal) => {
              const selection = runtime.sessionData.get("history-selection") as
                { filters: HistoryFilters; chain: number } | undefined;
              const options = historyOptions(
                runtime,
                client,
                queries,
                selection?.filters ?? {},
                selection?.chain ?? 0,
              );
              const data = await guarded(options.queryKey, signal, () =>
                queries.fetchInfiniteQuery({ ...options, staleTime: 0 }),
              );
              if ("denial" in data) throw new AppError("http", 403);
            },
          }
        : {}),
    },
  });
  const unregister = runtime.addCleanup(refresh.dispose);
  return {
    ...refresh,
    dispose: () => {
      unregister();
      refresh.dispose();
    },
  };
}
