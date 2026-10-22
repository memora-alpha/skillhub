import {
  infiniteQueryOptions,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import type { Page } from "@/lib/http/response";
import type { PaymentProjection } from "../../src/features/wallet/types/payment";
import type { FinancialRead } from "../../src/features/wallet/types/wallet";
import type { WalletRuntime } from "../../src/features/wallet/context/wallet-runtime";
import {
  createPaymentApi,
  type PaymentClient,
  type PaymentFilters,
} from "../../src/features/wallet/api/payment-api";
import { paymentListKey } from "../../src/features/wallet/utils/payment-query-keys";

type PaymentPage = Page<PaymentProjection>;
export type PaymentsData = InfiniteData<PaymentPage> & {
  denial?: "denied" | "not-found";
};
export function paymentItems(pages: PaymentPage[] = []) {
  const rows = new Map<string, PaymentProjection>();
  for (const page of pages) for (const row of page.data) rows.set(row.id, row);
  return [...rows.values()];
}
export function paymentsOptions(
  runtime: WalletRuntime | null,
  client: PaymentClient | null,
  queries: QueryClient,
  filters: PaymentFilters,
  chain: number,
) {
  return infiniteQueryOptions({
    queryKey: runtime
      ? paymentListKey(runtime.scope, filters.status, chain)
      : ["wallet", "payments-unavailable"],
    enabled:
      !!runtime?.capabilities.paymentStatus &&
      runtime.isCurrent() &&
      !!client?.requestPage,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: true,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (
      page: PaymentPage,
      _pages: PaymentPage[],
      _last: string | undefined,
      params: (string | undefined)[],
    ) =>
      page.pagination.hasMore &&
      page.pagination.nextCursor &&
      !params.includes(page.pagination.nextCursor)
        ? page.pagination.nextCursor
        : undefined,
    queryFn: async ({ pageParam, signal }) => {
      if (
        !runtime?.capabilities.paymentStatus ||
        !client ||
        !runtime.isCurrent()
      )
        throw new AppError("config");
      try {
        const page = await runtime.read(
          "paymentStatus",
          `list:${filters.status ?? "all"}:${chain}`,
          (s) => createPaymentApi(client).list(filters, pageParam, s),
          signal,
        );
        runtime.sessionData.delete("payment-list-denial");
        return page;
      } catch (error) {
        if (!runtime.isCurrent()) throw new AppError("session");
        if (error instanceof AppError && [403, 404].includes(error.status)) {
          const denial = error.status === 403 ? "denied" : "not-found";
          runtime.sessionData.set("payment-list-denial", denial);
          for (const query of queries
            .getQueryCache()
            .findAll({ queryKey: [...runtime.key, "payments", "list"] }))
            queries.setQueryData<PaymentsData>(query.queryKey, {
              pages: [],
              pageParams: [],
              denial,
            });
        }
        throw error;
      }
    },
  });
}
export function projectPayments(
  runtime: WalletRuntime | null,
  query: {
    data?: PaymentsData;
    error: unknown;
    isFetching: boolean;
    isFetchingNextPage?: boolean;
    isFetchNextPageError?: boolean;
  },
): FinancialRead<PaymentProjection[]> {
  if (runtime && !runtime.isCurrent())
    return { status: "session-ended", stale: false };
  if (!runtime?.capabilities.paymentStatus)
    return { status: "unavailable", stale: false };
  const denial = runtime.sessionData.get("payment-list-denial") as
    "denied" | "not-found" | undefined;
  if (denial || query.data?.denial)
    return { status: denial ?? query.data!.denial!, stale: false };
  if (query.data?.pages.length) {
    const data = paymentItems(query.data.pages),
      busy = query.isFetching && !query.isFetchingNextPage,
      failed = !!query.error && !query.isFetchNextPageError;
    return {
      status: busy
        ? "refreshing"
        : failed
          ? "refresh-error"
          : data.length
            ? "ready"
            : "empty",
      data,
      stale: busy || failed,
    };
  }
  return {
    status: query.isFetching
      ? "loading"
      : query.error
        ? "error"
        : "unavailable",
    stale: false,
  };
}
