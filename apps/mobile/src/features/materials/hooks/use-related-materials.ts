import { useIsFocused } from "expo-router";
import { useConnectionQuery } from "@/features/connections";
import type { ApiMaterial } from "../api/material-contracts";
import { useMaterialsApi } from "./use-materials";

export function useRelatedMaterials(material: ApiMaterial) {
  const api = useMaterialsApi();
  const focused = useIsFocused();
  return useConnectionQuery(
    ["materials", "related", material.skillId, material.id],
    (signal) => api.related(material.id, material.skillId, signal),
    focused && material.status === "PUBLISHED",
    { cancelOnDisable: true, refreshOnFocus: "stale" },
  );
}
