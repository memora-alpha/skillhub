import { useMemo } from "react";
import { useConnections, useConnectionQuery } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { createLearningPathsApi } from "../api/learning-paths-api";

export function useLearningPathsApi() {
  const runtime = useConnections();
  return useMemo(
    () => createLearningPathsApi(runtime.call, runtime.userId ?? ""),
    [runtime],
  );
}
export function useLearningPaths() {
  const api = useLearningPathsApi();
  return useConnectionQuery(["learning-paths", "mine"], (signal) =>
    api.mine(signal),
  );
}
export function useLearningPath(id: string) {
  const api = useLearningPathsApi();
  return useConnectionQuery(
    ["learning-paths", id],
    (signal) => api.detail(id, signal),
    uuid.safeParse(id).success,
  );
}
