import { useIsFocused } from "expo-router";
import { useConnectionList, useConnectionQuery } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { useMaterialsApi } from "./use-materials";

export function useMaterialFavorites() {
  const api = useMaterialsApi();
  const focused = useIsFocused();
  return useConnectionList(
    ["materials", "favorites", "pages"],
    api.favoritesPage,
    focused,
    { cancelOnDisable: true, refreshOnFocus: "stale" },
  );
}
export function useMaterialFavorite(materialId: string, enabled = true) {
  const api = useMaterialsApi();
  const focused = useIsFocused();
  return useConnectionQuery(
    ["materials", "favorites", "state", materialId],
    (signal) => api.isFavorite(materialId, signal),
    focused && enabled && uuid.safeParse(materialId).success,
    { cancelOnDisable: true, refreshOnFocus: "stale" },
  );
}
