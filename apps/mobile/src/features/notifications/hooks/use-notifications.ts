import { AppError } from "@/lib/http/errors";
import { useMemo } from "react";
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  useConnections,
  useConnectionList,
  useConnectionQuery,
} from "@/features/connections";
import {
  createNotificationsApi,
  type InboxNotification,
} from "../api/notifications-api";

function useNotificationsApi() {
  const { call } = useConnections();
  return useMemo(() => createNotificationsApi(call), [call]);
}

export function useNotifications() {
  const api = useNotificationsApi();
  return useConnectionList(["notifications"], (cursor, signal) =>
    api.list(cursor, signal),
  );
}

// Count across pages, stopping as soon as the capped badge is known.
export function useNotificationCount() {
  const api = useNotificationsApi();
  return useConnectionQuery(
    ["notifications", "unread-count"],
    async (signal) => {
      let cursor: string | undefined;
      let count = 0;
      const seen = new Set<string>();
      const ids = new Set<string>();
      do {
        const page = await api.list(cursor, signal);
        for (const item of page.items) {
          if (!ids.has(item.id) && !item.readAt) count++;
          ids.add(item.id);
        }
        if (count > 99) return 100;
        cursor = page.nextCursor ?? undefined;
        if (cursor && seen.has(cursor)) throw new AppError("protocol");
        if (cursor) seen.add(cursor);
      } while (cursor);
      return count;
    },
  );
}

export function useMarkNotificationRead() {
  const api = useNotificationsApi(),
    runtime = useConnections(),
    cache = useQueryClient();
  const queryKey = [...runtime.key, "notifications"];
  return useMutation({
    mutationFn: async (id: string) => {
      runtime.assertCurrent();
      await api.markRead(id);
      runtime.assertCurrent();
    },
    retry: false,
    onSuccess: (_result, id) => {
      if (!runtime.isCurrent()) return;
      // The 204 confirms read state; refresh retrieves the server's exact timestamp.
      cache.setQueryData<
        InfiniteData<{ items: InboxNotification[]; nextCursor: string | null }>
      >(
        queryKey,
        (previous) =>
          previous && {
            ...previous,
            pages: previous.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === id && !item.readAt
                  ? { ...item, readAt: new Date().toISOString() }
                  : item,
              ),
            })),
          },
      );
      void cache.invalidateQueries({ queryKey });
    },
    onError: () => {
      if (runtime.isCurrent()) void cache.invalidateQueries({ queryKey });
    },
  });
}
