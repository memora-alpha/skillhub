import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect, useIsFocused } from "expo-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useOptionalWalletRuntime } from "../context/WalletProvider";
import {
  historyOptions,
  projectHistory,
  fetchHistoryNext,
  historyStalled,
  isInvalidLedgerCursor,
} from "../utils/history-query";
import type { HistoryFilters } from "../types/transaction";

type Selection = { filters: HistoryFilters; chain: number };
export function useTransactions() {
  const runtime = useOptionalWalletRuntime(),
    queries = useQueryClient(),
    focused = useIsFocused();
  const [selection, setSelection] = useState<Selection>(
    () =>
      (runtime?.sessionData.get("history-selection") as Selection) ?? {
        filters: {},
        chain: 0,
      },
  );
  const options = historyOptions(
    runtime,
    runtime?.client ?? null,
    queries,
    selection.filters,
    selection.chain,
  );
  const query = useInfiniteQuery({
    ...options,
    enabled: !!options.enabled && focused,
  });
  const refetch = query.refetch;
  const refresh = useCallback(() => {
    if (focused && runtime?.capabilities.history && runtime.isCurrent())
      return refetch({ cancelRefetch: true });
  }, [focused, runtime, refetch]);
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
  function select(filters: HistoryFilters) {
    if (!runtime?.isCurrent()) return;
    const next = { filters, chain: selection.chain + 1 };
    runtime.sessionData.set("history-selection", next);
    setSelection(next);
  }
  const invalidCursor =
    isInvalidLedgerCursor(query.error) || historyStalled(query.data);
  const loadMore = () => {
    if (
      !focused ||
      !runtime?.capabilities.history ||
      invalidCursor ||
      !query.hasNextPage
    )
      return;
    return fetchHistoryNext(
      queries,
      options.queryKey,
      () => query.fetchNextPage({ cancelRefetch: false }),
      runtime.isCurrent,
    );
  };
  return {
    state: projectHistory(runtime, query),
    filters: selection.filters,
    select,
    refresh,
    restart: () => select(selection.filters),
    loadMore,
    hasMore: !!query.hasNextPage,
    busy: query.isFetching,
    loadingMore: query.isFetchingNextPage,
    pageError: query.isFetchNextPageError,
    invalidCursor,
  };
}
