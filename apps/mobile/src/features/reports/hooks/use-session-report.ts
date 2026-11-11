import { useIsFocused } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useConnections, useConnectionQuery } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { useReportsApi } from "./use-reports";
import { selectSessionReport } from "../utils/session-report";
import { reportStatusLabel } from "../utils/report-presentation";

export function useSessionReport(sessionId: string) {
  const api = useReportsApi(),
    runtime = useConnections(),
    focused = useIsFocused();
  const scope = useRef({ focused, sessionId, mounted: true });
  scope.current.focused = focused;
  scope.current.sessionId = sessionId;
  useEffect(() => {
    scope.current.mounted = true;
    return () => {
      scope.current.mounted = false;
    };
  }, []);
  const isCurrent = () =>
    runtime.isCurrent() &&
    scope.current.mounted &&
    scope.current.focused &&
    scope.current.sessionId === sessionId &&
    AppState.currentState === "active";
  const query = useConnectionQuery(
    ["reports"],
    (signal) => api.mine(signal),
    focused && uuid.safeParse(sessionId).success,
    { cancelOnDisable: true },
  );
  const selected = selectSessionReport(query.data ?? [], sessionId);
  return {
    report: selected
      ? { id: selected.id, statusLabel: reportStatusLabel(selected.status) }
      : undefined,
    checking: query.isFetching || query.isPending,
    error: query.error,
    isCurrent,
    async refresh() {
      const latest = await query.refetch({ cancelRefetch: false });
      if (!isCurrent() || latest.error) return;
      return selectSessionReport(latest.data ?? [], sessionId);
    },
  };
}
