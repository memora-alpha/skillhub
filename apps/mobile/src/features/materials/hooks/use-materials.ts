import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  useConnections,
  useConnectionQuery,
  useConnectionList,
} from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { createMaterialsApi } from "../api/materials-api";
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
export function useMyMaterials() {
  const api = useMaterialsApi();
  return useConnectionQuery(["materials", "mine"], (signal) =>
    api.mine(signal),
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
export function useMaterialOwnership(materialId: string) {
  const api = useMaterialsApi();
  return useConnectionQuery(
    ["materials", "orders", materialId],
    (signal) => api.ownedOrder(materialId, signal),
    uuid.safeParse(materialId).success,
  );
}
export function useMaterialSearch(q: string, accessType?: "FREE" | "PAID") {
  const api = useMaterialsApi(),
    runtime = useConnections();
  const query = useInfiniteQuery({
    queryKey: [...runtime.key, "materials", "search", q, accessType],
    enabled: runtime.enabled,
    retry: false,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api.search(q, accessType, pageParam, signal),
    getNextPageParam: (page) => page.nextPage,
  });
  return {
    ...query,
    items: [
      ...new Map(
        query.data?.pages
          .flatMap((page) => page.items)
          .map((item) => [item.id, item]) ?? [],
      ).values(),
    ],
  };
}
