import { useMemo } from "react";
import {
  useConnections,
  useConnectionQuery,
  useConnectionList,
} from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { createProposalsApi, type Proposal } from "../api/proposals-api";
import { listAllProposals } from "../api/list-all-proposals";
export function useProposalsApi() {
  const { call, userId } = useConnections();
  return useMemo(() => createProposalsApi(call, userId ?? ""), [call, userId]);
}
export function useProposal(id: string) {
  const api = useProposalsApi();
  return useConnectionQuery(
    ["proposal", id],
    (signal) => api.detail(id, signal),
    uuid.safeParse(id).success,
  );
}
export function useProposalList(
  direction: "sent" | "received" | "all",
  status?: Proposal["status"],
  learningRequestId?: string,
  valid = true,
) {
  const api = useProposalsApi();
  return useConnectionList(
    ["proposals", direction, status, learningRequestId],
    (cursor, signal) =>
      direction === "all"
        ? listAllProposals(api, status, cursor, signal)
        : api.list(direction, status, cursor, signal, learningRequestId),
    valid,
  );
}
