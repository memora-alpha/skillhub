import { useMemo } from "react";
import { useConnections, useConnectionQuery } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { createLearningPathsApi } from "../api/learning-paths-api";
import { useAgreementRefresh } from "./use-agreement-refresh";
import { editablePath } from "../utils/policy-api";

export function useLearningPathsApi() {
  const runtime = useConnections();
  return useMemo(
    () => createLearningPathsApi(runtime.call, runtime.userId ?? ""),
    [runtime],
  );
}
export function useLearningPaths(allowed = true) {
  const api = useLearningPathsApi();
  return useConnectionQuery(
    ["learning-paths", "mine"],
    (signal) => api.mine(signal),
    allowed,
    { cancelOnDisable: true },
  );
}
export function useLearningPath(id: string, allowed = true) {
  const api = useLearningPathsApi(),
    runtime = useConnections();
  const query = useConnectionQuery(
    ["learning-paths", id],
    (signal) => api.detail(id, signal),
    allowed && uuid.safeParse(id).success,
    { cancelOnDisable: true },
  );
  useAgreementRefresh(
    query.refetch,
    allowed &&
      runtime.enabled &&
      !!query.data &&
      editablePath(query.data) &&
      !query.error &&
      !query.denied,
    runtime.isCurrent,
  );
  return query;
}
