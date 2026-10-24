import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { z } from "zod";
import { useSessionsRuntime } from "../runtime";
import type { SessionRange } from "../types";
import { sessionReadGuard, refreshSessionRead } from "../utils/session-read";

function useSessionRead<T>(
  key: QueryKey,
  load: (signal: AbortSignal) => Promise<T>,
  enabled: boolean,
  staleTime = 0,
) {
  const runtime = useSessionsRuntime(),
    client = useQueryClient();
  const guard = useMemo(() => sessionReadGuard(client, key), [client, key]);
  const query = useQuery({
    queryKey: key,
    enabled,
    staleTime,
    retry: false,
    meta: { sessionReadGuard: guard },
    queryFn: ({ signal }) => guard.read(() => load(signal), runtime.isCurrent),
  });
  useEffect(() => {
    if (!enabled && staleTime > 0)
      void client.cancelQueries({
        queryKey: key,
        exact: true,
        type: "inactive",
      });
  }, [client, enabled, key, staleTime]);
  const visited = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      const refresh = () => refreshSessionRead(client, key, staleTime > 0);
      if (visited.current) void refresh();
      visited.current = true;
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active" && runtime.isCurrent()) void refresh();
      });
      return () => subscription.remove();
    }, [enabled, client, key, runtime.isCurrent, staleTime]),
  );
  return {
    ...query,
    data: enabled && !guard.denial ? query.data : undefined,
    enabled,
    denial: guard.denial,
  };
}
export function useSessionList(
  range: SessionRange,
  timezone: string,
  allowed = true,
) {
  const runtime = useSessionsRuntime();
  const key = useMemo(
    () => [...runtime.key, "list", range.from, range.to, timezone],
    [runtime.key, range.from, range.to, timezone],
  );
  return useSessionRead(
    key,
    (signal) => runtime.api.list(range, signal),
    runtime.enabled && allowed,
    30_000,
  );
}
export function useSessionDetail(id: string | undefined) {
  const runtime = useSessionsRuntime();
  const valid = z.uuid().safeParse(id).success;
  const key = useMemo(() => [...runtime.key, "detail", id], [runtime.key, id]);
  const query = useSessionRead(
    key,
    (signal) => runtime.api.detail(id!, signal),
    runtime.enabled && valid,
  );
  return { ...query, valid };
}
