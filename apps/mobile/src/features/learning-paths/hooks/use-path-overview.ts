import { useMemo } from "react";
import { useIsFocused } from "expo-router";
import {
  useConnectionList,
  useConnectionQuery,
  useConnections,
} from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { createPathOverviewApi } from "../api/path-overview-api";
import { useAgreementRefresh } from "./use-agreement-refresh";

function useOverviewApi() {
  const runtime = useConnections();
  return useMemo(() => createPathOverviewApi(runtime.call), [runtime]);
}
export function usePathOverview(pathId: string, allowed = true) {
  const runtime = useConnections(),
    api = useOverviewApi(),
    focused = useIsFocused();
  const enabled =
    allowed && runtime.enabled && focused && uuid.safeParse(pathId).success;
  const query = useConnectionQuery(
    ["learning-paths", pathId, "overview"],
    (signal) => api.overview(pathId, signal),
    enabled,
    { cancelOnDisable: true },
  );
  useAgreementRefresh(
    query.refetch,
    enabled &&
      !!query.data &&
      !query.error &&
      !query.denied &&
      (query.data.attentionCount > 0 ||
        !["SETTLED", "TERMINATED"].includes(query.data.settlement.status)),
    runtime.isCurrent,
  );
  return query;
}
export function usePathCases(pathId: string) {
  const runtime = useConnections(),
    api = useOverviewApi(),
    focused = useIsFocused();
  const enabled = runtime.enabled && focused && uuid.safeParse(pathId).success;
  const query = useConnectionList(
    ["learning-paths", pathId, "cases"],
    (cursor, signal) => api.cases(pathId, cursor, signal),
    enabled,
    { cancelOnDisable: true },
  );
  useAgreementRefresh(
    query.refetch,
    enabled &&
      !query.error &&
      !query.denied &&
      query.items.some((row) =>
        ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"].includes(row.status),
      ),
    runtime.isCurrent,
  );
  return query;
}
export function usePathCaseSummary(pathId: string, caseId: string) {
  const runtime = useConnections(),
    api = useOverviewApi(),
    focused = useIsFocused();
  const enabled =
    runtime.enabled &&
    focused &&
    uuid.safeParse(pathId).success &&
    uuid.safeParse(caseId).success;
  const query = useConnectionQuery(
    ["learning-paths", pathId, "cases", caseId],
    (signal) => api.caseSummary(pathId, caseId, signal),
    enabled,
    { cancelOnDisable: true },
  );
  useAgreementRefresh(
    query.refetch,
    enabled &&
      !!query.data &&
      !query.error &&
      !query.denied &&
      ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"].includes(query.data.status),
    runtime.isCurrent,
  );
  return query;
}
