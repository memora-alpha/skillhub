import { useCallback } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useConnections, useConnectionRefresh } from "@/features/connections";
import { connectionReadAccess } from "@/lib/http/read-access";
import { useConversations, useMessagesApi } from "./use-messages-api";
import { useChatOutboxEntries } from "../context/ChatOutbox";
import {
  conversationInbox,
  knownInboxConversations,
  newestMessage,
} from "../utils/conversation-preview";
import type { ApiConversation, ApiMessage } from "../api/messages-api";
import { hasUnreadIncoming } from "../utils/inbox-unread";

export function useConversationInbox() {
  const query = useConversations(),
    api = useMessagesApi(),
    runtime = useConnections(),
    cache = useQueryClient();
  const queued = useChatOutboxEntries();
  const activityIds = new Set([
    ...queued.map((entry) => entry.conversationId),
    ...cache
      .getQueriesData<ApiMessage | null>({
        queryKey: [...runtime.key, "conversation-preview"],
      })
      .flatMap(([, message]) => (message ? [message.conversationId] : [])),
  ]);
  const conversations = query.denied
    ? []
    : knownInboxConversations(
        query.items,
        cache
          .getQueriesData<ApiConversation>({
            queryKey: [...runtime.key, "conversation"],
          })
          .flatMap(([key, conversation]) =>
            conversation && !connectionReadAccess(cache, key).denied
              ? [conversation]
              : [],
          ),
        activityIds,
        runtime.userId ?? "",
      );
  const results = useQueries({
    queries: conversations.map((conversation) => {
      const key = [...runtime.key, "conversations", "preview", conversation.id];
      const access = connectionReadAccess(cache, key);
      return {
        queryKey: key,
        meta: { connectionReadAccess: access },
        enabled: runtime.enabled && !query.denied,
        retry: false,
        initialData: () => {
          const threadKey = [...runtime.key, "thread", conversation.id];
          if (connectionReadAccess(cache, threadKey).denied) return undefined;
          const messages = cache.getQueryData<{ messages: ApiMessage[] }>([
            ...runtime.key,
            "thread",
            conversation.id,
          ])?.messages;
          return messages
            ? {
                message: newestMessage(...messages),
                unread: hasUnreadIncoming(messages, runtime.userId),
              }
            : undefined;
        },
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          access.read(async () => {
            const page = await api.history(conversation.id, {
              signal,
            });
            return {
              message: newestMessage(...page.items),
              unread: hasUnreadIncoming(page.items, runtime.userId),
            };
          }, runtime.isCurrent),
      };
    }),
  });
  useConnectionRefresh(
    useCallback(() => {
      void cache.refetchQueries(
        {
          queryKey: [...runtime.key, "conversations", "preview"],
          type: "active",
          stale: true,
        },
        { cancelRefetch: false },
      );
    }, [cache, runtime]),
    runtime.enabled,
  );
  const messages = new Map(
    conversations.map((conversation, index) => {
      const key = [...runtime.key, "conversations", "preview", conversation.id];
      const result = results[index];
      const denied = connectionReadAccess(cache, key).denied;
      return [
        conversation.id,
        denied
          ? null
          : newestMessage(
              result?.data?.message,
              cache.getQueryData<ApiMessage | null>([
                ...runtime.key,
                "conversation-preview",
                conversation.id,
              ]),
            ),
      ] as const;
    }),
  );
  const items = conversationInbox(
    conversations,
    messages,
    queued,
    runtime.userId ?? "",
  ).map((item) => {
    const index = conversations.findIndex((c) => c.id === item.conversation.id);
    const result = results[index];
    const denied = connectionReadAccess(cache, [
      ...runtime.key,
      "conversations",
      "preview",
      item.conversation.id,
    ]).denied;
    if (denied)
      return { ...item, preview: "Không tải được tin nhắn", state: undefined };
    if (
      messages.get(item.conversation.id) ||
      queued.some((entry) => entry.conversationId === item.conversation.id)
    )
      return {
        ...item,
        unread:
          !result?.error &&
          !result?.isPending &&
          (result?.data?.unread ?? false),
      };
    let preview = item.preview;
    if (result?.error) preview = "Không tải được tin nhắn · Chạm để mở";
    else if (result?.isPending) preview = "Đang tải tin nhắn…";
    return { ...item, preview };
  });
  return {
    ...query,
    items,
    refetch: () =>
      Promise.all([
        query.refetch(),
        cache.invalidateQueries(
          { queryKey: [...runtime.key, "conversations", "preview"] },
          { cancelRefetch: false },
        ),
      ]),
  };
}
