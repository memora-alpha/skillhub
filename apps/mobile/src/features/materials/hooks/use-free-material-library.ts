import { useIsFocused } from "expo-router";
import { useConnectionList } from "@/features/connections";
import { useMaterialsApi } from "./use-materials";

export function useFreeMaterialLibrary() {
  const api = useMaterialsApi();
  const focused = useIsFocused();
  return useConnectionList(
    ["materials", "free-library", "pages"],
    api.freeLibraryPage,
    focused,
    {
      cancelOnDisable: true,
      refreshOnFocus: "stale",
    },
  );
}
