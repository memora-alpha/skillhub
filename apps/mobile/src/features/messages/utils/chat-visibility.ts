import type { ApiMessage } from "../api/messages-api";
import { isChatImage } from "./chat-attachment-kind";

// Display projection only. Keep the authorized server snapshot intact.
export function visibleChatMessage(
  message: ApiMessage,
  viewerId: string | undefined,
): ApiMessage {
  if (message.senderId === viewerId) return message;
  const attachments = message.attachments.filter(
    (file) => file.availability !== "REVOKED" || isChatImage(file.mimeType),
  );
  if (attachments.length === message.attachments.length) return message;
  return { ...message, attachments };
}
