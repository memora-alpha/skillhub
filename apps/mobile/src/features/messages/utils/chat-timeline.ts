import type { ApiMessage } from "../api/messages-api";
import type { QueuedText } from "../outbox/outbox-types";
import {
  scheduleMessageGroups,
  type ChatScheduleNotice,
} from "./schedule-notice";

export type ChatTimelineItem =
  | {
      id: string;
      kind: "message";
      message: ApiMessage;
      scheduleNotice?: ChatScheduleNotice;
    }
  | { id: string; kind: "queued"; entry: QueuedText };
export function chatTimeline(
  messages: ApiMessage[],
  queued: QueuedText[],
  deliveryKeys?: Map<string, string>,
): ChatTimelineItem[] {
  // Preserve the local row's identity after delivery and outbox reconciliation.
  for (const entry of queued) {
    if (entry.messageId)
      deliveryKeys?.set(entry.messageId, entry.clientMessageId);
  }
  const known = new Set(messages.map((item) => item.id));
  const items: ChatTimelineItem[] = [
    ...messages.map((message): ChatTimelineItem => ({
      id: deliveryKeys?.get(message.id) ?? message.id,
      kind: "message",
      message,
    })),
    ...queued.flatMap((entry): ChatTimelineItem[] => {
      if (entry.messageId && known.has(entry.messageId)) return [];
      if (entry.state === "sent" && entry.message)
        return [
          {
            id: deliveryKeys?.get(entry.message.id) ?? entry.message.id,
            kind: "message",
            message: entry.message,
          },
        ];
      return [{ id: entry.clientMessageId, kind: "queued", entry }];
    }),
  ];
  const schedules = scheduleMessageGroups(
    items.flatMap((item) => (item.kind === "message" ? [item.message] : [])),
  );
  return items.flatMap<ChatTimelineItem>((item) => {
    if (item.kind !== "message") return [item];
    const schedule = schedules.get(item.message.id);
    if (!schedule) return [item];
    return schedule.visible
      ? [{ ...item, id: schedule.id, scheduleNotice: schedule.notice }]
      : [];
  });
}
