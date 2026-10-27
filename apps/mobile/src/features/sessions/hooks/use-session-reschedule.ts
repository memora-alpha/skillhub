import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import { useRefreshLearningPath } from "@/features/learning-paths";
import { useSessionsRuntime } from "../runtime";
import type { LearningSession } from "../types";
import { createRescheduleAction } from "../utils/reschedule-action";
import { rescheduleSnapshot } from "../utils/reschedule-snapshot";
import { isRescheduleEligible } from "../utils/reschedule-form";
import { useSessionContext } from "./use-session-context";

export function useSessionReschedule(session: LearningSession | undefined) {
  const runtime = useSessionsRuntime(),
    client = useQueryClient();
  const query = useSessionContext(session),
    refreshPath = useRefreshLearningPath();
  const refetch = useRef(query.refetch);
  refetch.current = query.refetch;
  const sessionId = session?.id ?? "",
    pathId = session?.pathId ?? "";
  const action = useMemo(
    () =>
      createRescheduleAction({
        api: runtime.api,
        userId: runtime.userId,
        sessionId,
        pathId,
        isCurrent: runtime.isCurrent,
        readPath: async () => {
          const result = await refetch.current();
          if (result.error) throw result.error;
          if (!result.data) throw new AppError("protocol");
          return result.data;
        },
        onRead: async (detail) => {
          const key = [...runtime.key, "detail", sessionId];
          await client.cancelQueries({ queryKey: key, exact: true });
          if (!runtime.isCurrent()) return;
          client.setQueryData(key, detail);
          await Promise.allSettled([
            client.invalidateQueries({ queryKey: [...runtime.key, "list"] }),
            refreshPath(detail.pathId),
          ]);
        },
      }),
    [runtime, client, sessionId, pathId, refreshPath],
  );
  useFocusEffect(
    useCallback(() => {
      action.setActive(true);
      return () => action.setActive(false);
    }, [action]),
  );
  const state = useSyncExternalStore(
    action.subscribe,
    action.getSnapshot,
    action.getSnapshot,
  );
  const snapshot =
    session && query.context
      ? rescheduleSnapshot(session, query.context, runtime.userId)
      : undefined;
  return {
    ...state,
    snapshot,
    contextReady:
      runtime.enabled &&
      !!session &&
      !!snapshot &&
      !query.error &&
      !query.denied &&
      !query.isFetching &&
      !!query.context &&
      ["SCHEDULED", "ACTIVE"].includes(query.context.path.status) &&
      isRescheduleEligible(session),
    contextError: query.error,
    contextLoading: query.isLoading || query.isFetching,
    propose: action.propose,
    confirm: action.confirm,
    refresh: action.refresh,
  };
}
