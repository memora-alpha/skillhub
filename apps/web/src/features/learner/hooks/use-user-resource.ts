"use client";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useUserSession } from "../auth/session";
import { UserApiError } from "../api/client";
export function useUserResource<T>(path: string | null) {
  const { request, actor } = useUserSession();
  const query = useQuery({
    queryKey: ["learner", actor.userId, path],
    enabled: !!path,
    queryFn: ({ signal }) => request<T>(path!, { signal }),
  });
  return {
    data: query.error ? undefined : query.data?.data,
    pagination: query.data?.meta?.pagination,
    loading: !!path && (query.isPending || query.isFetching),
    error: query.error?.message,
    reload: () => {
      void query.refetch();
    },
  };
}
export function useUserList<T extends { id: string }>(path: string) {
  const { request, actor } = useUserSession();
  const query = useInfiniteQuery({
    queryKey: ["learner", actor.userId, path],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const reply = await request<T[]>(
        path +
          (pageParam
            ? (path.includes("?") ? "&" : "?") +
              new URLSearchParams({ cursor: pageParam })
            : ""),
        { signal },
      );
      if (!Array.isArray(reply.data))
        throw new UserApiError(502, "API_RESPONSE_INVALID");
      return reply;
    },
    getNextPageParam: (page, _pages, _last, parameters) => {
      const cursor = page.meta?.pagination?.nextCursor;
      if (cursor && parameters.includes(cursor))
        throw new UserApiError(502, "API_RESPONSE_INVALID");
      return cursor ?? undefined;
    },
  });
  return {
    items: query.error
      ? []
      : [
          ...new Map(
            query.data?.pages
              .flatMap((page) => page.data)
              .map((item) => [item.id, item]) ?? [],
          ).values(),
        ],
    loading: query.isPending || query.isFetching,
    error: query.error?.message,
    cursor: query.hasNextPage
      ? (query.data?.pages.at(-1)?.meta?.pagination?.nextCursor ?? null)
      : null,
    more: () => query.fetchNextPage(),
    reload: () => {
      void query.refetch();
    },
  };
}
