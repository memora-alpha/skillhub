export type InboxLatestMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  messageType: "TEXT" | "FILE" | "SYSTEM";
  preview: string;
  sentAt: Date;
};

export type InboxMessageSummary = {
  latestMessage: InboxLatestMessage | null;
  hasUnread: boolean;
};

/** Plain-text summary only: no attachment URLs, storage metadata or full body. */
export function inboxMessagePreview(
  text: string,
  type: InboxLatestMessage["messageType"],
) {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (normalized) return [...normalized].slice(0, 160).join("");
  if (type === "FILE") return "Đã gửi một tệp";
  return "Cập nhật cuộc trò chuyện";
}

export function newerInboxMessage(
  current: InboxLatestMessage | null,
  candidate: InboxLatestMessage | null,
) {
  if (!candidate) return current;
  if (!current) return candidate;
  const difference = candidate.sentAt.getTime() - current.sentAt.getTime();
  if (difference > 0 || (difference === 0 && candidate.id > current.id))
    return candidate;
  return current;
}
