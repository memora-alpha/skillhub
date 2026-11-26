import type { QueuedText } from "../outbox/outbox-types";
import { AppError } from "@/lib/http/errors";
import { chatFailureCopy } from "./chat-failure-copy";

// Chat checks the file manifest before committing publication. This 409 proves
// that the attachment was rejected, even when an earlier response was lost.
export function isChatMediaRejection(error: unknown): error is AppError {
  return (
    error instanceof AppError &&
    error.kind === "http" &&
    error.status === 409 &&
    error.code === "CONTENT_MODERATION_BLOCKED"
  );
}

export function isContentRejection(code?: string) {
  return (
    code === "CONTENT_MODERATION_BLOCKED" ||
    code === "CONTACT_INFORMATION_NOT_ALLOWED"
  );
}

export function chatSendNotice(entry: QueuedText, offline: boolean) {
  if (entry.state === "failed" && isContentRejection(entry.failureCode))
    return {
      tone: "blocked" as const,
      title: "Không gửi được tin nhắn",
      detail:
        entry.failureCode === "CONTACT_INFORMATION_NOT_ALLOWED"
          ? "Không được gửi thông tin cá nhân."
          : entry.attachment
            ? chatFailureCopy("CHAT_FILE_REJECTED", entry.attachment.mimeType)!
            : "Nội dung tin nhắn không phù hợp.",
    };
  if (entry.state === "failed")
    return {
      tone: "failed" as const,
      title: "Không gửi được tin nhắn",
      detail:
        chatFailureCopy(entry.failureCode, entry.attachment?.mimeType) ??
        "Không gửi được.",
    };
  if (entry.state === "sent") return undefined;
  if (offline) return { tone: "pending" as const, title: "Chờ kết nối để gửi" };
  if (entry.failureCode === "CHAT_RATE_LIMIT")
    return {
      tone: "pending" as const,
      title: "Bạn gửi hơi nhanh. Đang chờ để gửi tiếp…",
    };
  return {
    tone: "pending" as const,
    title: "Đang gửi…",
  };
}
