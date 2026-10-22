import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConnections } from "@/features/connections";
import { connectionReadAccess } from "@/lib/http/read-access";
import type { ApiConversation, ApiMessage } from "../api/messages-api";
import { orderConversations } from "../utils/inbox-order";

// Observe existing owner-scoped caches; sorting must not issue more requests.
export function useInboxOrder(items: ApiConversation[]) {
  const cache = useQueryClient(),
    runtime = useConnections();
  const snapshot = useCallback(() => {
    const activity = (id: string) => {
      const previewKey = [...runtime.key, "conversations", "preview", id];
      const threadKey = [...runtime.key, "thread", id];
      const preview = connectionReadAccess(cache, previewKey).denied
        ? undefined
        : cache.getQueryData<{ message: ApiMessage | null }>(previewKey)
            ?.message;
      const messages = connectionReadAccess(cache, threadKey).denied
        ? []
        : (cache.getQueryData<{ messages: ApiMessage[] }>(threadKey)
            ?.messages ?? []);
      return [preview, ...messages].reduce<string | undefined>(
        (latest, message) =>
          message &&
          (!latest || Date.parse(message.sentAt) > Date.parse(latest))
            ? message.sentAt
            : latest,
        undefined,
      );
    };
    return orderConversations(items, activity)
      .map((item) => item.id)
      .join(",");
  }, [cache, runtime.key, items]);
  const subscribe = useCallback(
    (changed: () => void) =>
      cache.getQueryCache().subscribe((event) => {
        const key = event.query.queryKey;
        if (
          runtime.key.every((part, index) => key[index] === part) &&
          ["conversations", "thread"].includes(String(key[runtime.key.length]))
        )
          changed();
      }),
    [cache, runtime.key],
  );
  const order = useSyncExternalStore(subscribe, snapshot, snapshot);
  const byId = new Map(items.map((item) => [item.id, item]));
  return order ? order.split(",").flatMap((id) => byId.get(id) ?? []) : [];
}
