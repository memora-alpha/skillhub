import { useConnections, useConnectionQuery } from "@/features/connections";
import type { ApiConversation } from "../api/messages-api";
import {
  conversationReference,
  readConversationContext,
} from "../api/conversation-context";

export function useConversationContext(
  conversation: ApiConversation,
  compact = false,
) {
  const runtime = useConnections();
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
        runtime.call,
        conversation,
        runtime.userId ?? "",
        signal,
        compact,
      ),
  );
  return {
    ...query,
    label: query.data ?? (query.isLoading ? "Đang tải chủ đề…" : "Đề xuất học"),
    reference: conversationReference(conversation.proposalId),
  };
}
