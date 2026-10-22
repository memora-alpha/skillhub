import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConnections } from "@/features/connections";
import { refreshLearningPath } from "../utils/refresh-learning-path";

export function useRefreshLearningPath() {
  const cache = useQueryClient(),
    runtime = useConnections();
  return useCallback(
    (pathId: string) =>
      refreshLearningPath(cache, runtime.key, pathId, runtime.isCurrent),
    [cache, runtime],
  );
}
