import {
  infiniteQueryOptions,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import type { WalletRuntime } from "../context/wallet-runtime";
import type { FinancialRead, WalletScope } from "../types/wallet";
import type {
  HistoryData,
  HistoryFilters,
  Transaction,
  TransactionPage,
} from "../types/transaction";
import {
  createTransactionApi,
  type TransactionClient,
} from "../api/transaction-api";
import { walletQueryKey } from "./wallet-query-keys";

export const historyKey = (
  scope: WalletScope,
  filters: HistoryFilters,
  chain: number,
) =>
  walletQueryKey(
    scope,
    "history",
    filters.type ?? null,
    filters.referenceType ?? null,
    chain,
  );
export function historyItems(pages: TransactionPage[] = []) {
  const byId = new Map<string, Transaction>();
  for (const page of pages) for (const row of page.data) byId.set(row.id, row);
  return [...byId.values()]; // Map replaces values without changing server order.
}
export function historyNext(
  page: TransactionPage,
  _pages: TransactionPage[],
  _param: string | undefined,
  params: (string | undefined)[],
) {
  const next = page.pagination.nextCursor;
  return page.pagination.hasMore && next && !params.includes(next)
    ? next
    : undefined;
}
export function historyStalled(data?: HistoryData) {
  const last = data?.pages.at(-1);
  return (
    !!last?.pagination.hasMore &&
    data!.pageParams.includes(last.pagination.nextCursor!)
  );
}
export const isInvalidLedgerCursor = (error: unknown) =>
  error instanceof AppError &&
  error.status === 400 &&
  error.code === "INVALID_LEDGER_CURSOR";
export function historyOptions(
  runtime: WalletRuntime | null,
  client: TransactionClient | null,
  queries: QueryClient,
  filters: HistoryFilters,
  chain: number,
) {
  const key = runtime
    ? historyKey(runtime.scope, filters, chain)
    : ["wallet", "history-unavailable"];
  return infiniteQueryOptions({
    queryKey: key,
    enabled: !!runtime?.capabilities.history && runtime.isCurrent() && !!client,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: historyNext,
    queryFn: async ({ pageParam, signal }) => {
      if (!runtime || !client) throw new AppError("config");
      try {
        return await runtime.read(
          "history",
          "ledger-list",
          (s) => createTransactionApi(client).list(filters, pageParam, s),
          signal,
        );
      } catch (error) {
        if (!runtime.isCurrent()) throw new AppError("session");
        if (error instanceof AppError && [403, 404].includes(error.status)) {
          // Erase all cached filter/chain projections, including cancellation's
          // revert target (setQueryData is a manual update in installed Query).
          for (const query of queries
            .getQueryCache()
            .findAll({ queryKey: [...runtime.key, "history"] }))
            queries.setQueryData<HistoryData>(query.queryKey, () => ({
              pages: [],
              pageParams: [],
              denial: error.status === 403 ? "denied" : "not-found",
            }));
        }
        throw error;
      }
    },
  });
}
function retainedHistoryStatus(busy: boolean, failed: boolean, count: number) {
  if (busy) return "refreshing";
  if (failed) return "refresh-error";
  return count ? "ready" : "empty";
}

function initialHistoryStatus(fetching: boolean, error: unknown) {
  if (fetching) return "loading";
  return error ? "error" : "unavailable";
}

export function projectHistory(
  runtime: WalletRuntime | null,
  query: {
    data?: HistoryData;
    error: unknown;
    isFetching: boolean;
    isFetchingNextPage?: boolean;
    isFetchNextPageError?: boolean;
  },
): FinancialRead<Transaction[]> {
  if (runtime && !runtime.isCurrent())
    return { status: "session-ended", stale: false };
  if (!runtime?.capabilities.history)
    return { status: "unavailable", stale: false };
  if (query.data?.denial) return { status: query.data.denial, stale: false };
  if (query.data?.pages.length) {
    const data = historyItems(query.data.pages),
      busy = query.isFetching && !query.isFetchingNextPage,
      failed = !!query.error && !query.isFetchNextPageError;
    return {
      status: retainedHistoryStatus(busy, failed, data.length),
      data,
      stale: busy || failed,
    };
  }
  return {
    status: initialHistoryStatus(query.isFetching, query.error),
    stale: false,
  };
}
export async function fetchHistoryNext(
  queries: QueryClient,
  key: QueryKey,
  fetchNext: () => Promise<unknown>,
  current: () => boolean,
) {
  if (!current() || queries.getQueryState(key)?.fetchStatus === "fetching")
    return;
  return fetchNext();
}
