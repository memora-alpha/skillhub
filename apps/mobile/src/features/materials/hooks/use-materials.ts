import { useCallback, useMemo } from "react";
import { useIsFocused } from "expo-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  useConnections,
  useConnectionQuery,
  useConnectionList,
  useConnectionRefresh,
} from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { createMaterialsApi } from "../api/materials-api";
import { connectionReadAccess } from "@/lib/http/read-access";
export function useMaterialsApi() {
  const runtime = useConnections();
  return useMemo(
    () => createMaterialsApi(runtime.call, runtime.userId ?? ""),
    [runtime],
  );
}
export function useMaterial(id: string) {
  const api = useMaterialsApi();
  return useConnectionQuery(
    ["materials", "detail", id],
    (signal) => api.detail(id, signal),
    uuid.safeParse(id).success,
  );
}
export function useMyMaterials(enabled = true, freshOnMount = false) {
  const api = useMaterialsApi();
  return useConnectionQuery(
    ["materials", "mine"],
    (signal) => api.mine(signal),
    enabled,
    { freshOnMount },
  );
}
export function useMyMaterialPages() {
  const api = useMaterialsApi();
  return useConnectionList(["materials", "mine", "pages"], api.minePage);
}
export function useMaterialOrderPages() {
  const api = useMaterialsApi();
  return useConnectionList(["materials", "orders", "pages"], api.ordersPage);
}
export function useMaterialOrders() {
  const api = useMaterialsApi();
  return useConnectionQuery(["materials", "orders"], (signal) =>
    api.orders(signal),
  );
}
export function useMaterialOwnership(materialId: string, enabled = true) {
  const api = useMaterialsApi();
  return useConnectionQuery(
    ["materials", "orders", materialId],
    (signal) => api.ownedOrder(materialId, signal),
    enabled && uuid.safeParse(materialId).success,
  );
}
export function usePublicMaterial(id: string, enabled = true) {
  const api = useMaterialsApi();
  return useConnectionQuery(
    ["materials", "public", id],
    (signal) => api.publicDetail(id, signal),
    enabled && uuid.safeParse(id).success,
    { refreshOnFocus: "stale", cancelOnDisable: true },
  );
}
export function useMaterialSearch(
  q: string,
  accessType?: "FREE" | "PAID",
  skillId?: string,
) {
  const focused = useIsFocused();
  const api = useMaterialsApi(),
    runtime = useConnections();
  const cache = useQueryClient();
  const key = useMemo(
    () => [...runtime.key, "materials", "search", q, accessType, skillId],
    [runtime.key, q, accessType, skillId],
  );
  const access = useMemo(() => connectionReadAccess(cache, key), [cache, key]);
  const query = useInfiniteQuery({
    queryKey: key,
    meta: { connectionReadAccess: access },
    enabled: runtime.enabled && focused,
    retry: false,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      access.read(
        () => api.search(q, accessType, pageParam, signal, skillId),
        runtime.isCurrent,
      ),
    getNextPageParam: (page) => page.nextPage,
  });
  useConnectionRefresh(
    useCallback(
      () =>
        cache.refetchQueries(
          { queryKey: key, exact: true, type: "active", stale: true },
          { cancelRefetch: false },
        ),
      [cache, key],
    ),
    runtime.enabled && focused,
  );
  return {
    ...query,
    data: access.denied ? undefined : query.data,
    denied: access.denied,
    total: access.denied ? undefined : query.data?.pages[0]?.total,
    items: access.denied
      ? []
      : [
          ...new Map(
            query.data?.pages
              .flatMap((page) => page.items)
              .map((item) => [item.id, item]) ?? [],
          ).values(),
        ],
  };
}
