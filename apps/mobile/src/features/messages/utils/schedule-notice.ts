import {
  readConfirmedForm,
  readScheduledMessage,
  readScheduleConfirmation,
  type ScheduleConfirmation,
} from "@/features/learning-paths/policy";
import type { ApiMessage } from "../api/messages-api";

export type ChatScheduleNotice = {
  pathId: string;
  locked: boolean;
  sessionCount?: number;
  startAt?: string;
  endAt?: string;
  confirmation?: ScheduleConfirmation;
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
  const confirmation = readScheduleConfirmation(message.messageText);
  if (confirmation)
    return confirmation.confirmedBy === message.senderId
      ? { pathId: confirmation.pathId, locked: false, confirmation }
      : null;
  const form = readConfirmedForm(message.messageText);
  return form?.kind === "schedule"
    ? {
        pathId: form.pathId,
        locked: false,
      }
    : null;
}

export function scheduleMessageGroups(messages: readonly ApiMessage[]) {
  const result = new Map<
    string,
    { visible: boolean; id: string; notice: ChatScheduleNotice }
  >();
  const groups = new Map<string, ScheduleMessage[]>();
  for (const message of messages) {
    const notice = readChatSchedule(message);
    if (!notice) continue;
    // Each new confirmation is a historical receipt for one participant and
    // direction. Do not collapse it into a different plan or a locked receipt.
    if (notice.confirmation) {
      result.set(message.id, {
        visible: true,
        id: `schedule-confirmation:${message.id}`,
        notice,
      });
      continue;
    }
    const key = `${message.conversationId}:${notice.pathId}`;
    const group = groups.get(key) ?? [];
    group.push({ message, notice });
    groups.set(key, group);
  }
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
