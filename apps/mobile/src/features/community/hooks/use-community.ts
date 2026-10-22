import { useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  useConnections,
  useConnectionRefresh,
  useConnectionQuery,
} from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { AppError } from "@/lib/http/errors";
import { connectionReadAccess } from "@/lib/http/read-access";
import { createCommunityApi } from "../api/community-api";

export function useCommunityApi() {
  const runtime = useConnections();
  return useMemo(
    () => createCommunityApi(runtime.call, runtime.userId ?? ""),
    [runtime],
  );
}
export function usePathReviews(
  pathId: string,
  counterpartId: string,
  enabled = true,
) {
  const api = useCommunityApi();
  return useConnectionQuery(
    ["reviews", pathId, counterpartId],
    (signal) => api.reviews(pathId, counterpartId, signal),
    enabled &&
      uuid.safeParse(pathId).success &&
      uuid.safeParse(counterpartId).success,
  );
}
export function useReputation() {
  const api = useCommunityApi();
  const runtime = useConnections();
  const cache = useQueryClient();
  const queryKey = useMemo(() => [...runtime.key, "reputation"], [runtime.key]);
  const access = useMemo(
    () => connectionReadAccess(cache, queryKey),
    [cache, queryKey],
  );
  const query = useInfiniteQuery({
    queryKey,
    meta: { connectionReadAccess: access },
    enabled: runtime.enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      access.read(() => api.reputation(pageParam, signal), runtime.isCurrent),
    getNextPageParam: (page, _pages, _last, parameters) => {
      if (page.nextCursor && parameters.includes(page.nextCursor))
        throw new AppError("protocol");
      return page.nextCursor ?? undefined;
    },
    retry: false,
  });
  useConnectionRefresh(query.refetch, runtime.enabled);
  const readable = runtime.enabled && runtime.isCurrent() && !access.denied;
  return {
    ...query,
    data: readable ? query.data : undefined,
    items: readable
      ? [
          ...new Map(
            query.data?.pages
              .flatMap((page) => page.items)
              .map((row) => [row.id, row]) ?? [],
          ).values(),
        ]
      : [],
    denied: access.denied,
  };
}
