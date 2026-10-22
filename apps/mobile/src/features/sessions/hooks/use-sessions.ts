import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnections, useConnectionQuery } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { createSessionsApi } from "../api/sessions-api";
import { sessionMonthRange } from "../utils/session-calendar";
import { useSessionRefresh } from "./use-session-refresh";

function useSessionsApi() {
  const runtime = useConnections();
  return useMemo(
    () => createSessionsApi(runtime.call, runtime.userId ?? ""),
    [runtime],
  );
}

export function useSessionsMonth(year: number, month: number) {
  const api = useSessionsApi();
  const range = sessionMonthRange(year, month);
  return useConnectionQuery(
    ["sessions", "mine", range.from, range.to],
    (signal) => api.mine(range, signal),
  );
}

export function useSession(id: string) {
  const api = useSessionsApi();
  const runtime = useConnections();
  const query = useConnectionQuery(
    ["sessions", id],
    (signal) => api.detail(id, signal),
    uuid.safeParse(id).success,
  );
  useSessionRefresh(
    query.refetch,
    runtime.enabled &&
      !!query.data &&
      !query.error &&
      !query.denied &&
      !["COMPLETED", "CANCELLED", "DISPUTED"].includes(query.data.status),
    runtime.isCurrent,
  );
  return query;
}

export function useSessionCompletion(id: string) {
  const api = useSessionsApi();
  const runtime = useConnections();
  const cache = useQueryClient();
  return useMutation({
    mutationKey: [...runtime.key, "sessions", id, "completion"],
    mutationFn: () => api.complete(id),
    retry: false,
    onSettled: async () => {
      if (!runtime.isCurrent()) return;
      // The endpoint records each participant only once. Reconcile through GET
      // after success or unknown delivery; never mark either party locally.
      await Promise.allSettled([
        cache.invalidateQueries({ queryKey: [...runtime.key, "sessions"] }),
        cache.invalidateQueries({
          queryKey: [...runtime.key, "learning-paths"],
        }),
      ]);
    },
  });
}
