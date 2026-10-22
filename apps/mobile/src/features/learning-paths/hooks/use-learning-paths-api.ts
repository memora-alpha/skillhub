import { useCallback, useMemo } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
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
  const query = useConnectionQuery(["learning-paths", "mine"], (signal) =>
    api.mine(signal),
  );
  useLearningRefresh(query.refetch, !query.denied);
  return query;
}
export function useLearningPath(id: string) {
  const api = useLearningPathsApi();
  const valid = uuid.safeParse(id).success;
  const query = useConnectionQuery(
    ["learning-paths", id],
    (signal) => api.detail(id, signal),
    valid,
  );
  useLearningRefresh(
    query.refetch,
    valid && !query.denied && query.data?.lockedVersion == null,
  );
  return query;
}

// Plan/schedule confirmations have no public SSE event. Only refresh the visible
// screen in the foreground; server state remains the source of truth for both users.
function useLearningRefresh(
  refresh: (options?: { cancelRefetch?: boolean }) => unknown,
  enabled: boolean,
) {
  const runtime = useConnections();
  useFocusEffect(
    useCallback(() => {
      if (!enabled || !runtime.enabled) return;
      const timer = setInterval(() => {
        if (AppState.currentState === "active" && runtime.isCurrent())
          refresh({ cancelRefetch: false });
      }, 5000);
      return () => clearInterval(timer);
    }, [enabled, refresh, runtime]),
  );
}
