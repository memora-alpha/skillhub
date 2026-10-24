import type { QueryClient } from "@tanstack/react-query";
const refreshes = new WeakMap<QueryClient, Promise<void>>();

export function createReadRefresh(client: QueryClient) {
  return () => {
    const previous = refreshes.get(client);
    if (previous) return previous;
    const pending = client
      .invalidateQueries({
        predicate: (query) => query.meta?.refreshResource === true,
        refetchType: "none",
      })
      .then(() =>
        client.refetchQueries(
          { type: "active" },
          { cancelRefetch: false, throwOnError: false },
        ),
      )
      .finally(() => {
        refreshes.delete(client);
      });
    refreshes.set(client, pending);
    return pending;
  };
}
