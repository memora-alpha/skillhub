import { useConnections, useConnectionQuery } from "@/features/connections";
import { useQueryClient } from "@tanstack/react-query";
import {
  readConversationResource,
  invalidateConversationResources,
} from "../utils/conversation-resource";
import type { ApiConversation } from "../api/messages-api";
import {
  conversationReference,
  readConversationContext,
} from "../api/conversation-context";

export function useConversationContext(
  conversation: ApiConversation,
  compact = false,
  enabled = true,
) {
  const runtime = useConnections();
  const cache = useQueryClient();
  const query = useConnectionQuery(
    [
      "conversations",
      "context",
      conversation.id,
      conversation.proposalId,
      conversation.learningRequestId,
      compact,
    ],
    (signal) =>
      readConversationContext(
        (path, options) =>
          readConversationResource(
            cache,
            runtime.key,
            runtime.call,
            path,
            options,
            conversation.id,
          ),
        conversation,
        runtime.userId ?? "",
        signal,
        compact,
      ),
    enabled,
    { refreshOnFocus: "stale", cancelOnDisable: true },
  );
  return {
    ...query,
    refetch: async () => {
      await invalidateConversationResources(
        cache,
        runtime.key,
        conversation.id,
      );
      return query.refetch({ cancelRefetch: false });
    },
    label: query.data ?? (query.isLoading ? "Đang tải chủ đề…" : "Đề xuất học"),
    reference: conversationReference(conversation.proposalId),
  };
}
