import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import {
  useConnections,
  useConnectionList,
  useConnectionQuery,
} from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { createLearningPathsApi } from "../api/learning-paths-api";
import { useAgreementRefresh } from "./use-agreement-refresh";
import { shouldWatchLearningPath } from "../utils/policy-api";

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
export function useLearningPathPages(allowed: boolean) {
  const api = useLearningPathsApi();
  const runtime = useConnections(),
    cache = useQueryClient();
  const recoveredError = useRef<unknown>(undefined);
  const query = useConnectionList(
    ["learning-paths", "mine", "pages"],
    api.minePage,
    allowed,
    {
      refreshOnFocus: "stale",
      cancelOnDisable: true,
    },
  );
  useEffect(() => {
    if (
      allowed &&
      runtime.isCurrent() &&
      query.isFetchNextPageError &&
      query.error instanceof AppError &&
      query.error.status === 400 &&
      query.error.code === "INVALID_LEARNING_PATH_CURSOR" &&
      recoveredError.current !== query.error
    ) {
      recoveredError.current = query.error;
      // Discard every old page. Appending page one to an old cursor chain is unsafe.
      void cache.resetQueries({
        queryKey: [...runtime.key, "learning-paths", "mine", "pages"],
        exact: true,
      });
    }
  }, [allowed, runtime, cache, query.error, query.isFetchNextPageError]);
  return query;
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
      shouldWatchLearningPath(query.data) &&
      !query.error &&
      !query.denied,
    runtime.isCurrent,
  );
  return query;
}
