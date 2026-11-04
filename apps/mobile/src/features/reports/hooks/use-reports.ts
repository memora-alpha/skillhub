import { useMemo } from "react";
import { useConnections, useConnectionQuery } from "@/features/connections";
import { createReportsApi } from "../api/reports-api";
export function useReportsApi() {
  const runtime = useConnections();
  return useMemo(
    () => createReportsApi(runtime.call, runtime.userId ?? ""),
    [runtime],
  );
}
export function useReports() {
  const api = useReportsApi();
  return useConnectionQuery(["reports"], (signal) => api.mine(signal));
}
export function useReport(id: string) {
  const api = useReportsApi();
  return useConnectionQuery(["reports", id], (signal) =>
    api.detail(id, signal),
  );
}
