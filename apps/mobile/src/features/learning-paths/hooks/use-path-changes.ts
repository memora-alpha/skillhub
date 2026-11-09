import { useEffect, useMemo } from "react";
import { useIsFocused } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useConnectionQuery, useConnections } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { useRefreshWallet } from "@/features/wallet";
import { createPathChangesApi } from "../api/path-changes-api";
import { useAgreementRefresh } from "./use-agreement-refresh";
import { openTermination } from "../utils/termination-policy";

export function usePathChangesApi() {
  const runtime = useConnections();
  return useMemo(() => createPathChangesApi(runtime.call), [runtime]);
}
export function useTerminationRequests(pathId: string, allowed = true) {
  const api = usePathChangesApi();
  const runtime = useConnections();
  const focused = useIsFocused();
  const cache = useQueryClient();
  const query = useConnectionQuery(
    ["learning-paths", pathId, "termination-requests"],
    (signal) => api.list(pathId, signal),
    allowed && focused && uuid.safeParse(pathId).success,
    { cancelOnDisable: true },
  );
  const revision = query.data
    ?.map((row) => `${row.id}:${row.version}`)
    .join(",");
  useEffect(() => {
    if (!allowed || !focused || !revision || !runtime.isCurrent()) return;
    // A peer/Admin transition can change Path and settlement together.
    for (const key of [
      ["learning-paths", pathId],
      ["learning-paths", pathId, "settlement"],
      ["learning-paths", pathId, "overview"],
      ["learning-paths", pathId, "termination-quote"],
      ["learning-paths", "mine"],
    ])
      void cache.invalidateQueries(
        { queryKey: [...runtime.key, ...key], exact: key[1] !== "mine" },
        { cancelRefetch: false },
      );
  }, [revision, allowed, focused, runtime, cache, pathId]);
  useAgreementRefresh(
    query.refetch,
    allowed &&
      focused &&
      !!query.data?.some(openTermination) &&
      !query.error &&
      !query.denied,
    runtime.isCurrent,
  );
  return query;
}
export function usePathSettlement(pathId: string, allowed = true) {
  const api = usePathChangesApi();
  const runtime = useConnections();
  const focused = useIsFocused();
  const cache = useQueryClient();
  const refreshWallet = useRefreshWallet();
  const query = useConnectionQuery(
    ["learning-paths", pathId, "settlement"],
    (signal) => api.settlement(pathId, signal),
    allowed && focused && uuid.safeParse(pathId).success,
    { cancelOnDisable: true },
  );
  const status = query.data?.status;
  useEffect(() => {
    if (
      !allowed ||
      !focused ||
      !runtime.isCurrent() ||
      !status ||
      !["SETTLED", "TERMINATED"].includes(status)
    )
      return;
    void refreshWallet();
    void cache.invalidateQueries(
      { queryKey: [...runtime.key, "learning-paths", pathId], exact: true },
      { cancelRefetch: false },
    );
    void cache.invalidateQueries(
      { queryKey: [...runtime.key, "learning-paths", pathId, "overview"] },
      { cancelRefetch: false },
    );
    void cache.invalidateQueries(
      { queryKey: [...runtime.key, "learning-paths", "mine"] },
      { cancelRefetch: false },
    );
  }, [status, allowed, focused, runtime, pathId, cache, refreshWallet]);
  useAgreementRefresh(
    query.refetch,
    allowed &&
      focused &&
      !!query.data &&
      !["SETTLED", "TERMINATED", "NOT_LOCKED"].includes(query.data.status) &&
      !query.error &&
      !query.denied,
    runtime.isCurrent,
  );
  return query;
}
