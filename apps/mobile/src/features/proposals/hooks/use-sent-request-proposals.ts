import { useConnectionQuery, useConnections } from "@/features/connections";
import { useProposalsApi } from "./use-proposals-api";
import { readSentRequestProposals } from "../api/sent-request-proposals";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
export function useSentRequestProposals(
  options: {
    enabled?: boolean;
    refreshOnFocus?: "always" | "stale";
  } = {},
) {
  const api = useProposalsApi();
  const cache = useQueryClient(),
    runtime = useConnections();
  const query = useConnectionQuery(
    ["proposals", "sent-request-status"],
    (signal) =>
      readSentRequestProposals(
        (cursor, s) => api.list("sent", undefined, cursor, s),
        signal,
      ),
    options.enabled ?? true,
    options,
  );
  useEffect(() => {
    if (options.enabled === false)
      void cache.cancelQueries({
        queryKey: [...runtime.key, "proposals", "sent-request-status"],
        exact: true,
        type: "inactive",
      });
  }, [cache, runtime.key, options.enabled]);
  return {
    ...query,
    refreshIfStale: () =>
      cache.refetchQueries(
        {
          queryKey: [...runtime.key, "proposals", "sent-request-status"],
          exact: true,
          type: "active",
          stale: true,
        },
        { cancelRefetch: false },
      ),
  };
}
