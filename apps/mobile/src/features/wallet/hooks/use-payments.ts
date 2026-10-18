import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useOptionalWalletRuntime } from "../context/WalletProvider";
import { paymentsOptions, projectPayments } from "../utils/payments-query";
import { isInvalidLedgerCursor } from "../utils/history-query";
import type { PaymentFilters } from "../api/payment-api";

// Transport preparation only: no caller selects/activates discovery by default.
export function usePayments(selected = false) {
  const runtime = useOptionalWalletRuntime(),
    queries = useQueryClient(),
    focused = useIsFocused();
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background",
  );
  const [selection, setSelection] = useState<{
    filters: PaymentFilters;
    chain: number;
  }>({ filters: {}, chain: 0 });
  const options = paymentsOptions(
    runtime,
    runtime?.client ?? null,
    queries,
    selection.filters,
    selection.chain,
  );
  const query = useInfiniteQuery({
    ...options,
    enabled: !!options.enabled && selected && focused && foreground,
  });
  useFocusEffect(
    useCallback(() => {
      const cancel = () => {
        if (selected)
          void queries.cancelQueries({
            queryKey: options.queryKey,
            exact: true,
          });
      };
      const listener = AppState.addEventListener("change", (next) => {
        setForeground(next === "active");
        if (next !== "active") cancel();
      });
      const remove = () => {
          listener.remove();
          cancel();
        },
        unregister = runtime?.addCleanup(remove);
      return () => {
        remove();
        unregister?.();
      };
    }, [runtime, queries, selected, selection.filters.status, selection.chain]),
  );
  const change = useCallback(
    (filters: PaymentFilters) => {
      if (!runtime?.isCurrent()) return;
      void queries.cancelQueries({ queryKey: options.queryKey, exact: true });
      setSelection((old) => ({ filters, chain: old.chain + 1 }));
    },
    [runtime, queries, options.queryKey],
  );
  const last = query.data?.pages.at(-1),
    stalled =
      !!last?.pagination.hasMore &&
      query.data!.pageParams.includes(last.pagination.nextCursor!);
  const invalidCursor = isInvalidLedgerCursor(query.error) || stalled;
  return {
    state: selected
      ? projectPayments(runtime, query)
      : { status: "unavailable" as const, stale: false },
    filters: selection.filters,
    select: change,
    refresh: () => change(selection.filters),
    restart: () => change(selection.filters),
    loadMore: () => {
      if (
        selected &&
        focused &&
        foreground &&
        !query.isFetching &&
        query.hasNextPage &&
        !invalidCursor &&
        runtime?.isCurrent()
      )
        return query.fetchNextPage({ cancelRefetch: false });
    },
    hasMore: !!query.hasNextPage,
    busy: query.isFetching,
    pageError: query.isFetchNextPageError,
    invalidCursor,
  };
}
