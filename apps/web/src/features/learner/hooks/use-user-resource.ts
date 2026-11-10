"use client";
import { isConnectionFailure } from "@/lib/network/connection-store";
import { pageUrl } from "../api/page-url";
import { useMemo } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useUserSession } from "../auth/session";
import { UserApiError } from "../api/client";

function isTemporaryFailure(error: Error) {
  return (
    error instanceof UserApiError &&
    (error.status === 0 ||
      error.status === 408 ||
      error.status === 429 ||
      error.status >= 500)
  );
}
export function useUserResource<T>(
  path: string | null,
  options?: {
    refetchInterval?: (data: T | undefined) => number | false;
    retainOnTemporaryError?: boolean;
    pollOnTemporaryError?: boolean;
  },
) {
  const { request, actor } = useUserSession();
  const query = useQuery({
    queryKey: ["learner", actor.userId, path],
    enabled: !!path,
    queryFn: ({ signal }) => request<T>(path!, { signal }),
    refetchInterval: (query) =>
      query.state.error &&
      !(options?.pollOnTemporaryError && isTemporaryFailure(query.state.error))
        ? false
        : (() => {
            const interval =
              options?.refetchInterval?.(query.state.data?.data) ?? false;
            return query.state.error && interval
              ? Math.max(interval, 10000)
              : interval;
          })(),
    refetchIntervalInBackground: false,
  });
  return {
    data:
      query.error &&
      !isConnectionFailure(query.error) &&
      !(options?.retainOnTemporaryError && isTemporaryFailure(query.error))
        ? undefined
        : query.data?.data,
    pagination: query.data?.meta?.pagination,
    loading: !!path && (query.isPending || query.isFetching),
    initialLoading: !!path && query.isPending,
    error: query.error?.message,
    failure: query.error,
    reload: () => {
      void query.refetch();
    },
  };
}
export function useUserList<T extends { id: string }>(
  path: string,
  nestedItems = false,
) {
  const { request, actor } = useUserSession();
  const query = useInfiniteQuery({
    queryKey: ["learner", actor.userId, path],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const raw = await request<T[] | { items: T[] }>(
        pageUrl(path, pageParam),
        { signal },
      );
      const reply = {
        ...raw,
        data:
          nestedItems && !Array.isArray(raw.data)
            ? raw.data.items
            : (raw.data as T[]),
      };
      if (
        !Array.isArray(reply.data) ||
        (pageParam && reply.meta?.pagination?.nextCursor === pageParam)
      )
        throw new UserApiError(502, "API_RESPONSE_INVALID");
      return reply;
    },
    getNextPageParam: (page, _pages, _last, parameters) => {
      const cursor = page.meta?.pagination?.nextCursor;
      // This callback also runs during render. Stop a cyclic cursor rather than
      // throwing out of React and replacing the whole screen with an error.
      if (cursor && parameters.includes(cursor)) return undefined;
      return cursor ?? undefined;
    },
  });
  // Pages keep their identity between fetches; don't flatten and deduplicate the
  // entire loaded list again for every loading/error notification or local edit.
  const items = useMemo(
    () => [
      ...new Map(
        query.data?.pages
          .flatMap((page) => page.data)
          .map((item) => [item.id, item]) ?? [],
      ).values(),
    ],
    [query.data],
  );
  // A failed next page must not erase the pages already being read. Permission
  // and missing-resource responses still hide cached content immediately.
  const showItems = !query.error || isTemporaryFailure(query.error);
  const staleNotice =
    showItems && items.length ? "Đang hiển thị dữ liệu đã tải trước đó. " : "";
  return {
    items: showItems ? items : [],
    loading: query.isPending || query.isFetching,
    initialLoading: query.isPending,
    error: query.error ? staleNotice + query.error.message : undefined,
    cursor: query.hasNextPage
      ? (query.data?.pages.at(-1)?.meta?.pagination?.nextCursor ?? null)
      : null,
    more: () => {
      if (query.hasNextPage && !query.isFetching)
        return query.fetchNextPage({ cancelRefetch: false });
    },
    reload: () => {
      void query.refetch();
    },
  };
}
