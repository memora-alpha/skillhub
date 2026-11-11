import { useMemo } from "react";
import {
  useConnections,
  useConnectionList,
  useConnectionQuery,
} from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import {
  createTagRequestsApi,
  type TagRequestStatus,
} from "../api/tag-requests-api";

export function useTagRequestsApi() {
  const runtime = useConnections();
  return useMemo(
    () => createTagRequestsApi(runtime.call, runtime.userId ?? ""),
    [runtime],
  );
}
export function useTagRequests(status?: TagRequestStatus) {
  const api = useTagRequestsApi();
  return useConnectionList(
    ["tag-requests", "list", status ?? "ALL"],
    (cursor, signal) => api.list(status, cursor, signal),
  );
}
export function useTagRequest(id: string) {
  const api = useTagRequestsApi();
  return useConnectionQuery(
    ["tag-requests", "detail", id],
    (signal) => api.detail(id, signal),
    uuid.safeParse(id).success,
  );
}
