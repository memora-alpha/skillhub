import { useInfiniteQuery } from "@tanstack/react-query";
import { useRequestsRuntime } from "../context";

export function useTagOptions(q?: string, active = true) {
  const { api, key, enabled } = useRequestsRuntime();
  return useInfiniteQuery({
    queryKey: [...key, "tags", q],
    enabled: enabled && active,
    retry: false,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.tags(pageParam, q, signal),
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
