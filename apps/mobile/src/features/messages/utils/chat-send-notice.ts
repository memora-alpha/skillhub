import type { QueuedText } from "../outbox/outbox-types";
import { AppError } from "@/lib/http/errors";

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
          ? "Tin nhắn này chứa số điện thoại, email hoặc đường dẫn liên hệ cá nhân."
          : "Tin nhắn này có thể chứa ngôn từ nhạy cảm hoặc nội dung không phù hợp nên không thể gửi!",
    };
  if (entry.state === "failed")
    return {
      tone: "failed" as const,
      title: entry.failure ?? "Chưa gửi được tin nhắn",
    };
  if (entry.state === "sent") return undefined;
  if (offline) return { tone: "pending" as const, title: "Chờ kết nối để gửi" };
  if (entry.failureCode === "CHAT_RATE_LIMIT")
    return {
      tone: "pending" as const,
      title: "Gửi quá nhanh · Đang chờ gửi lại",
    };
  return {
    tone: "pending" as const,
    title: "Đang gửi…",
  };
}
