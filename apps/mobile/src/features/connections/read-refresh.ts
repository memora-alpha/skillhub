import type { QueryClient, QueryKey } from "@tanstack/react-query";

export type ConnectionReadTarget = QueryKey | { key: QueryKey; exact: boolean };

export function invalidateConnectionReads(
  cache: QueryClient,
  base: QueryKey,
  targets: readonly ConnectionReadTarget[],
) {
  return Promise.all(
    targets.map((target) => {
      const selection =
        "key" in target ? target : { key: target, exact: false };
      return cache.invalidateQueries(
        { queryKey: [...base, ...selection.key], exact: selection.exact },
        { cancelRefetch: false },
      );
    }),
  );
}

export function refreshConnectionReads(
  cache: QueryClient,
  queryKey: QueryKey,
  staleOnly: boolean,
  exact = true,
) {
  return cache.refetchQueries(
    { queryKey, exact, type: "active", ...(staleOnly ? { stale: true } : {}) },
    { cancelRefetch: false },
  );
}
