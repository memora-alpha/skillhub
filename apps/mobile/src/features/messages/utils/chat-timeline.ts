import { mergeMessages, type ApiMessage } from "../api/messages-api";
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
  const published = mergeMessages(
    queued.flatMap((entry) =>
      entry.state === "sent" && entry.message ? [entry.message] : [],
    ),
    // The delivery receipt can predate revocation. Fresh thread data wins.
    messages,
  );
  const known = new Set(published.map((item) => item.id));
  const local = queued.filter(
    (entry) =>
      !(entry.messageId && known.has(entry.messageId)) &&
      !(entry.state === "sent" && entry.message),
  );
  const failed = local
    .filter((entry) => entry.state === "failed")
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const items: ChatTimelineItem[] = [];
  let failedIndex = 0;
  // Failed attempts stay at their original time instead of pinning themselves
  // after every new delivery. Server messages always keep their sequence order.
  for (const message of published) {
    while (
      failedIndex < failed.length &&
      Date.parse(failed[failedIndex]!.createdAt) < Date.parse(message.sentAt)
    ) {
      const entry = failed[failedIndex++]!;
      items.push({ id: entry.clientMessageId, kind: "queued", entry });
    }
    items.push({
      id: deliveryKeys?.get(message.id) ?? message.id,
      kind: "message",
      message,
    });
  }
  for (const entry of failed.slice(failedIndex))
    items.push({ id: entry.clientMessageId, kind: "queued", entry });
  // Active sends remain at the end in enqueue order, including with clock skew.
  for (const entry of local)
    if (entry.state !== "failed")
      items.push({ id: entry.clientMessageId, kind: "queued", entry });
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
