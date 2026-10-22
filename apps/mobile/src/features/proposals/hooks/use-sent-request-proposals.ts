import { useConnectionQuery } from "@/features/connections";
import { useProposalsApi } from "./use-proposals-api";
import { readSentRequestProposals } from "../api/sent-request-proposals";
export function useSentRequestProposals() {
  const api = useProposalsApi();
  return useConnectionQuery(["proposals", "sent-request-status"], (signal) =>
    readSentRequestProposals(
      (cursor, s) => api.list("sent", undefined, cursor, s),
      signal,
    ),
  );
}
