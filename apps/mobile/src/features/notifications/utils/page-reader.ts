import type { QueryClient } from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import type { createNotificationsApi } from "../api/notifications-api";

export function notificationPageReader(
  cache: QueryClient,
  base: readonly unknown[],
  api: ReturnType<typeof createNotificationsApi>,
) {
  return async (cursor?: string, signal?: AbortSignal) => {
    if (signal?.aborted) throw new AppError("session");
    const result = await cache.fetchQuery({
      queryKey: [...base, "notifications", "page", cursor ?? null],
      meta: { refreshResource: true },
      staleTime: 30_000,
      retry: false,
      queryFn: ({ signal: pageSignal }) => api.list(cursor, pageSignal),
    });
    if (signal?.aborted) throw new AppError("session");
    return result;
  };
}
