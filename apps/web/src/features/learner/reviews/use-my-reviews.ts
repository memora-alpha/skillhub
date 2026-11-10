"use client";
import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useUserSession } from "../auth/session";
import { UserApiError } from "../api/client";
import { pageUrl } from "../api/page-url";
import { readReviewPage } from "./review-contract";

export function useMyReviews(direction: "received" | "sent") {
  const { actor, request } = useUserSession();
  const endpoint = `me/reviews?direction=${direction}&limit=20`;
  const query = useInfiniteQuery({
    queryKey: ["learner", actor.userId, endpoint],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const reply = await request<unknown>(pageUrl(endpoint, pageParam), {
        signal,
      });
      const data = readReviewPage(reply.data);
      if (pageParam && reply.meta?.pagination?.nextCursor === pageParam)
        throw new UserApiError(502, "API_RESPONSE_INVALID");
      return { ...reply, data };
    },
    getNextPageParam: (page, _pages, _last, cursors) => {
      const cursor = page.meta?.pagination?.nextCursor;
      return cursor && !cursors.includes(cursor) ? cursor : undefined;
    },
  });
  const rows = useMemo(
    () => [
      ...new Map(
        query.data?.pages
          .flatMap((page) => page.data.items)
          .map((row) => [row.id, row]) ?? [],
      ).values(),
    ],
    [query.data],
  );
  const temporary =
    query.error instanceof UserApiError &&
    (query.error.status === 0 ||
      query.error.status === 408 ||
      query.error.status === 429 ||
      query.error.status >= 500);
  const readable = !query.error || temporary;
  return {
    rows: readable ? rows : [],
    summary: readable ? query.data?.pages[0]?.data.summary : undefined,
    initialLoading: query.isPending,
    loading: query.isFetching,
    error: query.error?.message,
    cursor: query.hasNextPage
      ? (query.data?.pages.at(-1)?.meta?.pagination?.nextCursor ?? null)
      : null,
    reload: () => {
      void query.refetch();
    },
    more: () => {
      if (query.hasNextPage && !query.isFetching)
        void query.fetchNextPage({ cancelRefetch: false });
    },
  };
}
