"use client";
import { useQuery } from "@tanstack/react-query";
import { useUserSession } from "../auth/session";
import { readCursorSnapshot } from "../api/cursor-snapshot";

export function useUserSnapshot<T extends { id: string }>(
  path: string,
  options?: {
    enabled?: boolean;
    scope?: string;
    stopAt?: (item: T) => boolean;
  },
) {
  const { request, actor } = useUserSession();
  const enabled = options?.enabled !== false;
  const query = useQuery({
    queryKey: ["learner", actor.userId, path, "snapshot", options?.scope ?? ""],
    enabled,
    queryFn: ({ signal }) =>
      readCursorSnapshot<T>(
        (url, signal) => request<T[]>(url, { signal }),
        path,
        signal,
        options?.stopAt,
      ),
  });
  return {
    items: query.error ? [] : (query.data ?? []),
    loading: enabled && (query.isPending || query.isFetching),
    error: query.error?.message,
    complete: enabled && query.isSuccess && !query.isFetching,
    reload: () => query.refetch(),
  };
}
