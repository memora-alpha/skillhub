import { useIsFocused } from "expo-router";
import { useConnectionQuery, useConnections } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { usePathChangesApi } from "./use-path-changes";
import { useAgreementRefresh } from "./use-agreement-refresh";

export function useTerminationQuote(pathId: string) {
  const api = usePathChangesApi();
  const runtime = useConnections();
  const focused = useIsFocused();
  const enabled = focused && uuid.safeParse(pathId).success;
  const query = useConnectionQuery(
    ["learning-paths", pathId, "termination-quote"],
    (signal) => api.quote(pathId, signal),
    enabled,
    { cancelOnDisable: true },
  );
  useAgreementRefresh(
    query.refetch,
    enabled && !!query.data && !query.error && !query.denied,
    runtime.isCurrent,
  );
  return query;
}
