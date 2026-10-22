import type { QueryClient } from "@tanstack/react-query";
import type { ApiConversation, ApiMessage } from "../api/messages-api";
import type { QueuedText } from "../outbox/outbox-types";
import {
  readPlanShare,
  readConfirmedForm,
  confirmedFormLabels,
} from "@/features/learning-paths/policy";

export function knownInboxConversations(
  listed: ApiConversation[],
  known: ApiConversation[],
  activityIds: ReadonlySet<string>,
  userId: string,
) {
  const byId = new Map(
    listed.map((conversation) => [conversation.id, conversation]),
  );
  for (const conversation of known)
    if (
      !byId.has(conversation.id) &&
      activityIds.has(conversation.id) &&
      [conversation.participantAId, conversation.participantBId].includes(
        userId,
      )
    )
      byId.set(conversation.id, conversation);
  return [...byId.values()];
}

export function newestMessage(...messages: (ApiMessage | null | undefined)[]) {
  return messages.reduce<ApiMessage | null>(
    (latest, message) =>
      message &&
      (!latest || BigInt(message.sequence) >= BigInt(latest.sequence))
        ? message
        : latest,
    null,
  );
}
export function rememberLatestMessage(
  cache: QueryClient,
  base: readonly unknown[],
  message: ApiMessage,
) {
  cache.setQueryData<ApiMessage | null>(
    [...base, "conversation-preview", message.conversationId],
    (previous) => newestMessage(previous, message),
  );
}
export type InboxConversation = {
  conversation: ApiConversation;
  preview: string;
  activityAt: string;
  state?: "pending" | "failed";
  unread?: boolean;
};
export function conversationInbox(
  conversations: ApiConversation[],
  messages: ReadonlyMap<string, ApiMessage | null>,
  queued: QueuedText[],
  userId: string,
): InboxConversation[] {
  return conversations
    .map((conversation): InboxConversation => {
      let message = messages.get(conversation.id) ?? null;
      const entries = queued.filter(
        (entry) => entry.conversationId === conversation.id,
      );
      for (const entry of entries)
        message = newestMessage(message, entry.message);
      const pending = entries.findLast(
        (entry) =>
          entry.state !== "sent" &&
          (!entry.messageId || entry.messageId !== message?.id),
      );
      if (
        pending &&
        (!message ||
          Date.parse(pending.createdAt) >= Date.parse(message.sentAt))
      )
        return {
          conversation,
          preview: `Bạn: ${pending.messageText}`,
          activityAt: pending.createdAt,
          state: pending.state === "failed" ? "failed" : "pending",
        };
      const form = readConfirmedForm(message?.messageText ?? "");
      const text = form
        ? `Đã xác nhận ${confirmedFormLabels[form.kind].toLowerCase()}`
        : readPlanShare(message?.messageText ?? "")
          ? "Lộ trình học được chia sẻ"
          : message?.messageText.trim() ||
            (message?.messageType === "FILE" ? "Đã gửi một tệp" : "");
      const sender = message?.senderId === userId ? "Bạn: " : "";
      return {
        conversation,
        preview: message
          ? `${sender}${text || "Cập nhật cuộc trò chuyện"}`
          : "Bắt đầu trò chuyện",
        activityAt: message?.sentAt ?? conversation.createdAt,
      };
    })
    .sort(
      (a, b) =>
        Date.parse(b.activityAt) - Date.parse(a.activityAt) ||
        a.conversation.id.localeCompare(b.conversation.id),
    );
}
