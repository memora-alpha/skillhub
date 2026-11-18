import { useCallback, useEffect, useMemo } from "react";
import { useIsFocused } from "expo-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  useConnections,
  useConnectionRefresh,
  useConnectionQuery,
} from "@/features/connections";
import { connectionReadAccess } from "@/lib/http/read-access";
import { AppError } from "@/lib/http/errors";
import { uuid } from "@/lib/http/contracts";
import { useMaterialsApi } from "./use-materials";

export function useMaterialReviews(materialId: string) {
  const api = useMaterialsApi();
  const focused = useIsFocused();
  const runtime = useConnections();
  const cache = useQueryClient();
  const key = useMemo(
    () => [...runtime.key, "materials", "reviews", materialId],
    [runtime.key, materialId],
  );
  const access = useMemo(() => connectionReadAccess(cache, key), [cache, key]);
  const query = useInfiniteQuery({
    queryKey: key,
    meta: { connectionReadAccess: access },
    enabled: focused && runtime.enabled,
    initialPageParam: undefined as string | undefined,
    retry: false,
    queryFn: ({ pageParam, signal }) =>
      access.read(
        () => api.reviews(materialId, pageParam, signal),
        runtime.isCurrent,
      ),
    getNextPageParam: (page, _pages, _lastParam, parameters) => {
      if (page.nextCursor && parameters.includes(page.nextCursor))
        throw new AppError("protocol");
      return page.nextCursor ?? undefined;
    },
  });
  useConnectionRefresh(
    useCallback(() => {
      void cache.refetchQueries(
        { queryKey: key, exact: true, type: "active", stale: true },
        { cancelRefetch: false },
      );
    }, [cache, key]),
    focused && runtime.enabled,
  );
  useEffect(() => {
    if (!focused) void cache.cancelQueries({ queryKey: key, exact: true });
  }, [cache, key, focused]);
  const reviews = {
    ...query,
    data: access.denied ? undefined : query.data,
    denied: access.denied,
    summary: access.denied ? undefined : query.data?.pages[0]?.summary,
    items: access.denied
      ? []
      : [
          ...new Map(
            query.data?.pages
              .flatMap((page) => page.items)
              .map((row) => [row.id, row]) ?? [],
          ).values(),
        ],
  };
  return { reviews, focused };
}

export function useMaterialReviewEligibility(
  materialId: string,
  enabled = true,
) {
  const api = useMaterialsApi();
  const focused = useIsFocused();
  return useConnectionQuery(
    ["materials", "review-eligibility", materialId],
    (signal) => api.reviewEligibility(materialId, signal),
    focused && enabled && uuid.safeParse(materialId).success,
    { cancelOnDisable: true, refreshOnFocus: "stale" },
  );
}
