import { useInfiniteQuery } from "@tanstack/react-query";
import { useRequestsRuntime } from "../context";

export function useTagOptions(q?: string) {
  const { api, key, enabled } = useRequestsRuntime();
  return useInfiniteQuery({
    queryKey: [...key, "tags", q],
    enabled,
    retry: false,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.tags(pageParam, q),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}
export function useOfferingOptions() {
  const { api, key, enabled } = useRequestsRuntime();
  return useInfiniteQuery({
    queryKey: [...key, "offerings"],
    enabled,
    retry: false,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.offerings(pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}
