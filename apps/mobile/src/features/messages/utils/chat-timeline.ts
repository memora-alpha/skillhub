import type { ApiMessage } from "../api/messages-api";
import type { QueuedText } from "../outbox/outbox-types";

export type ChatTimelineItem =
  | { id: string; kind: "message"; message: ApiMessage }
  | { id: string; kind: "queued"; entry: QueuedText };
export function chatTimeline(
  messages: ApiMessage[],
  queued: QueuedText[],
): ChatTimelineItem[] {
  const known = new Set(messages.map((item) => item.id));
  return [
    ...messages.map((message): ChatTimelineItem => ({
      id: message.id,
      kind: "message",
      message,
    })),
    ...queued.flatMap((entry): ChatTimelineItem[] => {
      if (entry.messageId && known.has(entry.messageId)) return [];
      if (entry.state === "sent" && entry.message)
        return [
          { id: entry.message.id, kind: "message", message: entry.message },
        ];
      return [{ id: entry.clientMessageId, kind: "queued", entry }];
    }),
  ];
}
