import { useCallback, useMemo } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import { useRequestsRuntime } from "../context";
import type { RequestFilters, OwnerRequest } from "../types";
import { requestReadGuard } from "../utils/request-read";
import {
  requestListOptions,
  requestListItems,
  fetchRequestNextPage,
} from "../utils/request-list-query";
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
) {
  const { api, key, enabled, isCurrent } = useRequestsRuntime();
  const client = useQueryClient();
  const options = requestListOptions(api, key, scope, filters);
  const query = useInfiniteQuery({
    ...options,
    enabled,
  });
  const refresh = useCallback(() => {
    if (enabled && isCurrent()) void query.refetch();
  }, [enabled, isCurrent, query.refetch]);
  useRefreshOnFocus(refresh);
  const loadMore = () => {
    if (enabled && query.hasNextPage)
      return fetchRequestNextPage(
        client,
        options.queryKey,
        () => query.fetchNextPage({ cancelRefetch: false }),
        isCurrent,
      );
  };
  return { ...query, items: requestListItems(query.data?.pages), loadMore };
}
export function useRequestDetail(id: string | undefined) {
  const { api, key, enabled, isCurrent } = useRequestsRuntime();
  const client = useQueryClient();
  const access = useMemo(
    () => requestReadGuard(client, [...key, "detail", id]),
    [client, key, id],
  );
  const valid = z.uuid().safeParse(id).success;
  const query = useQuery({
    queryKey: [...key, "detail", id],
    meta: { requestReadGuard: access },
    enabled: enabled && valid,
    queryFn: () => access.read(() => api.detail(id!), isCurrent),
    retry: false,
  });
  const refresh = useCallback(() => {
    if (enabled && valid) void query.refetch();
  }, [enabled, valid, query.refetch]);
  useRefreshOnFocus(refresh);
  if (query.error) access.fail(query.error);
  return { ...query, valid, readDenied: access.denial };
}
export function useSkillOptions(q?: string) {
  const { api, key, enabled } = useRequestsRuntime();
  return useInfiniteQuery({
    queryKey: [...key, "skills", q],
    enabled,
    retry: false,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.skills(pageParam, q),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}
export function useSkillName(id: string | undefined) {
  const { api, key, enabled } = useRequestsRuntime();
  return useQuery({
    queryKey: [...key, "skill", id],
    enabled: enabled && !!id,
    queryFn: () => api.skill(id!),
    retry: false,
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
