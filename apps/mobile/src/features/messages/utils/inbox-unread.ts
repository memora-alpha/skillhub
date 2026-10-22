import type { ApiMessage } from "../api/messages-api";

// Incoming readAt is the viewer's receipt. Outgoing readAt belongs to the peer.
// This detects unread evidence in the loaded page, not an unread total.
export function hasUnreadIncoming(
  messages: readonly Pick<ApiMessage, "senderId" | "readAt">[],
  userId: string | undefined,
) {
  return (
    !!userId &&
    messages.some(
      (message) => message.senderId !== userId && message.readAt === null,
    )
  );
}
