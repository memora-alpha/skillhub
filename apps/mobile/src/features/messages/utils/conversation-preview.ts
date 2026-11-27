import type { QueryClient } from "@tanstack/react-query";
import {
  mergeMessages,
  type ApiConversation,
  type ApiMessage,
} from "../api/messages-api";
import type { QueuedText } from "../outbox/outbox-types";
import { readChatSchedule } from "./schedule-notice";
import { visibleChatMessage } from "./chat-visibility";
import { attachmentCopy, isChatImage } from "./chat-attachment-kind";
import {
  conversationActivityAt,
  compareConversationActivity,
} from "./inbox-order";
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
  // A receipt may arrive after a history/SSE refresh of the same message.
  // Its sequence proves publication, not the freshness of availability/readAt.
  cache.setQueryData<ApiMessage | null>(
    [...base, "conversation-preview", message.conversationId],
    (previous) => newestMessage(message, previous),
  );
  cache.setQueryData<{ message: ApiMessage | null; unread: boolean }>(
    [...base, "conversations", "preview", message.conversationId],
    (previous) =>
      previous
        ? { ...previous, message: newestMessage(message, previous.message) }
        : undefined,
  );
}
export function rememberDeliveredMessage(
  cache: QueryClient,
  base: readonly unknown[],
  message: ApiMessage,
) {
  rememberLatestMessage(cache, base, message);
  // Do not seed a partial history or invent a history cursor.
  cache.setQueryData<{ messages: ApiMessage[]; nextCursor: string | null }>(
    [...base, "thread", message.conversationId],
    (previous) =>
      previous
        ? { ...previous, messages: mergeMessages([message], previous.messages) }
        : undefined,
  );
}
export type InboxConversation = {
  conversation: ApiConversation;
  preview: string;
  activityAt: string;
  state?: "pending" | "failed";
  unread?: boolean;
  previewSenderId?: string;
};
function inboxMessageText(message: ApiMessage) {
  const schedule = readChatSchedule(message);
  if (schedule?.locked) return "Lịch học đã chốt";
  if (schedule?.confirmation)
    return schedule.confirmation.bothConfirmed
      ? "Hai bên đã đồng ý lịch học · Chưa chốt"
      : "Đã đồng ý lịch học · Chờ người còn lại";
  const form = readConfirmedForm(message.messageText);
  if (form)
    return `Đã xác nhận ${confirmedFormLabels[form.kind].toLowerCase()}`;
  if (readPlanShare(message.messageText)) return "Lộ trình học được chia sẻ";
  if (message.messageText.trim()) return message.messageText.trim();
  if (message.messageType !== "FILE") return "";
  const imageOnly =
    message.attachments.length > 0 &&
    message.attachments.every((file) => isChatImage(file.mimeType));
  return imageOnly ? "Đã gửi một ảnh" : "Đã gửi một tệp";
}

function visibleInboxText(message: ApiMessage | null, userId: string) {
  if (!message) return { text: "", visible: null };
  const visible = visibleChatMessage(message, userId);
  const revokedOnly =
    !visible.messageText.trim() &&
    !visible.attachments.some((file) => file.availability !== "REVOKED") &&
    message.attachments.some((file) => file.availability === "REVOKED") &&
    message.senderId !== userId;
  if (!revokedOnly) return { text: inboxMessageText(visible), visible };
  const imageOnly = message.attachments.every((file) =>
    isChatImage(file.mimeType),
  );
  const mime = imageOnly ? message.attachments[0]?.mimeType : undefined;
  return { text: attachmentCopy("Tệp không còn khả dụng.", mime), visible };
}

function queuedInboxPreview(
  conversation: ApiConversation,
  pending: QueuedText,
  userId: string,
): InboxConversation {
  const attachment = isChatImage(pending.attachment?.mimeType) ? "Ảnh" : "Tệp";
  return {
    conversation,
    preview: `Bạn: ${pending.messageText || attachment}`,
    activityAt: conversationActivityAt(conversation, pending.createdAt),
    state: pending.state === "failed" ? "failed" : "pending",
    previewSenderId: userId,
  };
}
export function conversationInbox(
  conversations: ApiConversation[],
  messages: ReadonlyMap<string, ApiMessage | null>,
  queued: QueuedText[],
  userId: string,
): InboxConversation[] {
  const queuedByConversation = new Map<string, QueuedText[]>();
  for (const entry of queued) {
    const entries = queuedByConversation.get(entry.conversationId);
    if (entries) entries.push(entry);
    else queuedByConversation.set(entry.conversationId, [entry]);
  }
  return conversations
    .map((conversation): InboxConversation => {
      let message = messages.get(conversation.id) ?? null;
      const entries = queuedByConversation.get(conversation.id) ?? [];
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
        return queuedInboxPreview(conversation, pending, userId);
      const { visible, text } = visibleInboxText(message, userId);
      const sender = message?.senderId === userId ? "Bạn: " : "";
      return {
        conversation,
        preview: message
          ? `${sender}${text || "Cập nhật cuộc trò chuyện"}`
          : "Bắt đầu trò chuyện",
        activityAt: conversationActivityAt(conversation, message?.sentAt),
        ...(visible && visible.messageType !== "SYSTEM"
          ? { previewSenderId: visible.senderId }
          : {}),
      };
    })
    .sort((a, b) =>
      compareConversationActivity(
        a.conversation,
        b.conversation,
        a.activityAt,
        b.activityAt,
      ),
    );
}
