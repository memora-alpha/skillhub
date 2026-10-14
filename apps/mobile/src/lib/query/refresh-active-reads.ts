import type { QueryClient } from "@tanstack/react-query";

export function createReadRefresh(client: QueryClient) {
  let pending: Promise<void> | undefined;
  return () => {
    pending ??= client
      .refetchQueries(
        { type: "active" },
        { cancelRefetch: false, throwOnError: false },
      )
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}
