import { useCallback, useEffect, useMemo } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  hashKey,
} from "@tanstack/react-query";
import { z } from "zod";
import { useRequestsRuntime } from "../context";
import type { RequestFilters, OwnerRequest } from "../types";
import { readDenial, requestReadGuard } from "../utils/request-read";
import {
  requestListOptions,
  requestListItems,
  fetchRequestNextPage,
  refreshRequestList,
  canAutoLoadRequestPage,
  evictDeniedRequestList,
} from "../utils/request-list-query";
import { requestSkillOptions } from "../utils/request-skill-query";
import {
  cachedOwnRequest,
  type RequestDetailOptions,
} from "../utils/request-detail-cache";
export function useRefreshOnFocus(refetch: () => unknown) {
  useFocusEffect(
    useCallback(() => {
      refetch();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") refetch();
      });
      return () => subscription.remove();
    }, [refetch]),
  );
}
export function useRequestList(
  scope: "mine" | "feed" | "recommended",
  filters: RequestFilters = {},
  active = true,
  options: { firstPageOnly?: boolean } = {},
) {
  const { api, key, enabled, isCurrent } = useRequestsRuntime();
  const client = useQueryClient();
  const queryOptions = requestListOptions(
    api,
    key,
    scope,
    filters,
    options.firstPageOnly,
  );
  const signature = hashKey(queryOptions.queryKey);
  const query = useInfiniteQuery({
    ...queryOptions,
    enabled: enabled && active,
  });
  const denied = readDenial(query.error);
  useEffect(() => {
    evictDeniedRequestList(client, JSON.parse(signature));
  }, [client, signature, query.error]);
  useEffect(() => {
    if (!active)
      void client.cancelQueries({
        queryKey: JSON.parse(signature),
        exact: true,
        type: "inactive",
      });
  }, [active, client, signature]);
  const refresh = useCallback(() => {
    if (enabled && active && isCurrent())
      void refreshRequestList(client, JSON.parse(signature), true);
  }, [enabled, active, isCurrent, client, signature]);
  useRefreshOnFocus(refresh);
  const loadMore = () => {
    if (enabled && active && !denied && query.hasNextPage)
      return fetchRequestNextPage(
        client,
        queryOptions.queryKey,
        () => query.fetchNextPage({ cancelRefetch: false }),
        isCurrent,
      );
  };
  const items = denied ? [] : requestListItems(query.data?.pages);
  const autoLoadMore = () => {
    const current = client.getQueryState(queryOptions.queryKey);
    if (
      canAutoLoadRequestPage({
        active: enabled && active && isCurrent(),
        hasNextPage: query.hasNextPage,
        fetching: current?.fetchStatus === "fetching",
        error: current?.error,
        count: items.length,
      })
    )
      return loadMore();
  };
  return {
    ...query,
    data: denied ? undefined : query.data,
    hasNextPage: !denied && query.hasNextPage,
    isFetchNextPageError: !denied && query.isFetchNextPageError,
    refetch: () => query.refetch({ cancelRefetch: false }),
    items,
    loadMore,
    autoLoadMore,
  };
}
export function useRequestDetail(
  id: string | undefined,
  options: RequestDetailOptions = {},
) {
  const { api, key, enabled, isCurrent } = useRequestsRuntime();
  const client = useQueryClient();
  const access = useMemo(
    () => requestReadGuard(client, [...key, "detail", id]),
    [client, key, id],
  );
  const valid = z.uuid().safeParse(id).success;
  const active = options.active !== false;
  const wait = !!options.waitForOwnList;
  const staleOnly = options.refreshOnFocus === "stale";
  const queryKey = useMemo(() => [...key, "detail", id], [key, id]);
  const own = options.preferOwnList
    ? cachedOwnRequest(client, key, id, access)
    : undefined;
  const previous = client.getQueryData<{ version: number }>(queryKey);
  const useOwn = own && own.item.version >= (previous?.version ?? 0);
  const query = useQuery({
    queryKey,
    meta: { requestReadGuard: access },
    enabled: enabled && valid && active && !wait && !useOwn,
    queryFn: ({ signal }) =>
      access.read(() => api.detail(id!, signal), isCurrent),
    retry: false,
  });
  const refresh = useCallback(() => {
    if (!enabled || !valid || !active || wait) return;
    if (staleOnly)
      void client.refetchQueries(
        { queryKey, exact: true, type: "active", stale: true },
        { cancelRefetch: false },
      );
    else void query.refetch();
  }, [
    enabled,
    valid,
    active,
    wait,
    staleOnly,
    client,
    queryKey,
    query.refetch,
  ]);
  useRefreshOnFocus(refresh);
  useEffect(() => {
    if (!active)
      void client.cancelQueries({ queryKey, exact: true, type: "inactive" });
  }, [active, client, queryKey]);
  if (query.error) access.fail(query.error);
  const data = access.denial ? undefined : useOwn ? own.item : query.data;
  return {
    ...query,
    data,
    isPending: !data && query.isPending,
    isLoading: !data && query.isLoading,
    valid,
    readDenied: access.denial,
  };
}
export function useSkillOptions(q?: string, active = true) {
  const { api, key, enabled } = useRequestsRuntime();
  return useInfiniteQuery({
    queryKey: [...key, "skills", q],
    enabled: enabled && active,
    retry: false,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.skills(pageParam, q, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}
export function useSkillName(id: string | undefined) {
  const { api, key, enabled } = useRequestsRuntime();
  const cache = useQueryClient();
  return useQuery({
    ...requestSkillOptions(api, key, id, cache),
    enabled: enabled && !!id,
  });
}
export function useRequestSync() {
  const { key, isCurrent } = useRequestsRuntime();
  const queryClient = useQueryClient();
  return async (result?: OwnerRequest) => {
    if (isCurrent()) {
      if (result)
        queryClient.setQueryData([...key, "detail", result.id], result);
      await queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

export function useRefreshRequestDetails(
  options: { preferOwnList?: boolean } = {},
) {
  const { key, isCurrent } = useRequestsRuntime();
  const client = useQueryClient();
  const preferOwnList = !!options.preferOwnList;
  return useCallback(() => {
    if (!isCurrent()) return Promise.resolve();
    return client.refetchQueries(
      {
        queryKey: [...key, "detail"],
        type: "active",
        predicate: (query) => {
          if (!preferOwnList) return true;
          const id = query.queryKey[key.length + 1];
          const own =
            typeof id === "string"
              ? cachedOwnRequest(
                  client,
                  key,
                  id,
                  requestReadGuard(client, query.queryKey),
                )
              : undefined;
          const detail = client.getQueryData<{ version: number }>(
            query.queryKey,
          );
          return !own?.fresh || own.item.version < (detail?.version ?? 0);
        },
      },
      { cancelRefetch: false },
    );
  }, [client, key, isCurrent, preferOwnList]);
}
