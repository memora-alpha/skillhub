import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionsRuntime } from "../runtime";
import { createCompletionAction } from "../utils/completion-action";

export function useSessionAction(sessionId: string) {
  const runtime = useSessionsRuntime(),
    client = useQueryClient();
  const action = useMemo(
    () =>
      createCompletionAction({
        api: runtime.api,
        userId: runtime.userId,
        sessionId,
        isCurrent: runtime.isCurrent,
        onDetail: async (detail) => {
          const detailKey = [...runtime.key, "detail", sessionId];
          await client.cancelQueries({ queryKey: detailKey, exact: true });
          if (!runtime.isCurrent()) return;
          client.setQueryData(detailKey, detail);
          await client.invalidateQueries({
            queryKey: [...runtime.key, "list"],
          });
        },
      }),
    [runtime, client, sessionId],
  );
  useEffect(() => {
    action.setActive(true);
    return () => action.setActive(false);
  }, [action]);
  const state = useSyncExternalStore(
    action.subscribe,
    action.getSnapshot,
    action.getSnapshot,
  );
  return { ...state, run: action.run, refresh: action.refresh };
}
