"use client";
import { useQuery } from "@tanstack/react-query";
import { useUserSession } from "../auth/session";
import { countUnreadNotifications } from "../api/unread-notifications";

export function useUnreadNotifications() {
  const { request, actor } = useUserSession();
  const query = useQuery({
    queryKey: ["learner", actor.userId, "notifications/unread-count"],
    queryFn: ({ signal }) =>
      countUnreadNotifications(
        (path, signal) => request(path, { signal }),
        signal,
      ),
    // Also refresh while visible if SSE is unavailable or another tab marks read.
    refetchInterval: 60000,
  });
  return {
    count: query.error ? undefined : query.data,
    loading: query.isPending,
    refreshing: query.isFetching,
    error: query.error?.message,
    reload: query.refetch,
  };
}
