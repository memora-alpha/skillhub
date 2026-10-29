import {
  readConfirmedForm,
  readScheduledMessage,
} from "@/features/learning-paths/policy";
import type { ApiMessage } from "../api/messages-api";

export type ChatScheduleNotice = {
  pathId: string;
  locked: boolean;
  sessionCount?: number;
  startAt?: string;
  endAt?: string;
};
type ScheduleMessage = { message: ApiMessage; notice: ChatScheduleNotice };

function latestScheduleMessage(messages: readonly ScheduleMessage[]) {
  return messages.reduce<ScheduleMessage | undefined>(
    (latest, item) =>
      !latest || BigInt(item.message.sequence) > BigInt(latest.message.sequence)
        ? item
        : latest,
    undefined,
  );
}
export function readChatSchedule(
  message: ApiMessage,
): ChatScheduleNotice | null {
  if (message.messageType !== "TEXT" || message.attachments.length) return null;
  const locked = readScheduledMessage(message.messageText);
  if (locked) return { ...locked, locked: true };
  const form = readConfirmedForm(message.messageText);
  return form?.kind === "schedule"
    ? {
        pathId: form.pathId,
        locked: false,
      }
    : null;
}

export function scheduleMessageGroups(messages: readonly ApiMessage[]) {
  const groups = new Map<string, ScheduleMessage[]>();
  for (const message of messages) {
    const notice = readChatSchedule(message);
    if (!notice) continue;
    const key = `${message.conversationId}:${notice.pathId}`;
    const group = groups.get(key) ?? [];
    group.push({ message, notice });
    groups.set(key, group);
  }
  const result = new Map<
    string,
    { visible: boolean; id: string; notice: ChatScheduleNotice }
  >();
  for (const [key, group] of groups) {
    const latest = latestScheduleMessage(group);
    if (!latest) continue;
    const locked = latestScheduleMessage(
      group.filter((item) => item.notice.locked),
    );
    const notice = locked?.notice ?? {
      pathId: latest.notice.pathId,
      locked: false,
    };
    for (const item of group)
      result.set(item.message.id, {
        visible: item.message.id === latest.message.id,
        id: `schedule:${key}`,
        notice,
      });
  }
  return result;
}
