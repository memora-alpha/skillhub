import type { ApiMessage } from "../api/messages-api";

// readAt on an outgoing message is the peer's read receipt. Show its furthest
// known position once, even when newer messages are still unread or incoming.
export function lastSeenOutgoingId(
  messages: readonly ApiMessage[],
  userId: string | undefined,
) {
  let last: ApiMessage | undefined;
  for (const message of messages) {
    if (
      userId &&
      message.senderId === userId &&
      message.messageType !== "SYSTEM" &&
      message.readAt &&
      (!last || BigInt(message.sequence) > BigInt(last.sequence))
    )
      last = message;
  }
  return last?.id;
}
