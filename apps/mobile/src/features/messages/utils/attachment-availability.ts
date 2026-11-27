import { AppError } from "@/lib/http/errors";
import type { AttachmentAvailability } from "../api/message-contracts";
import type { ChatFileStatus } from "../api/chat-attachment-contracts";
import { attachmentCopy, isChatImage } from "./chat-attachment-kind";
import { chatFailureCopy } from "./chat-failure-copy";
import type { ApiMessage } from "../api/messages-api";

export function revokedAttachmentCopy(files: ApiMessage["attachments"]) {
  const revoked = files.filter((file) => file.availability === "REVOKED");
  const mime = revoked.every((file) => isChatImage(file.mimeType))
    ? revoked[0]?.mimeType
    : undefined;
  return revoked.every((file) => file.restrictionReason === "REVOKED")
    ? attachmentCopy("Tệp không còn khả dụng.", mime)
    : chatFailureCopy("CHAT_FILE_REVOKED", mime)!;
}

export function canDownloadAttachment(availability?: AttachmentAvailability) {
  // Legacy deployments omit this field and still authorize each download.
  return availability === undefined || availability === "AVAILABLE";
}

export function attachmentAvailabilityLabel(
  availability?: AttachmentAvailability,
  mimeType?: string,
  moderationStatus?: ChatFileStatus["moderationStatus"],
) {
  if (moderationStatus === "REVIEW_REQUIRED" && availability === "PENDING_SCAN")
    return attachmentCopy("Tệp cần kiểm tra thêm.", mimeType);
  switch (availability) {
    case "PENDING_SCAN":
      return "Đang tải lên…";
    case "REVOKED":
      return attachmentCopy("Tệp không còn khả dụng.", mimeType);
    case "UNAVAILABLE":
      return attachmentCopy("Không thể mở tệp này", mimeType);
    default:
      return undefined;
  }
}

export function attachmentDownloadProblem(error: unknown, mimeType?: string) {
  if (!(error instanceof AppError)) return;
  if (error.code === "CONTENT_MODERATION_BLOCKED")
    return attachmentCopy("Tệp chứa nội dung không phù hợp.", mimeType);
  if (error.code === "FILE_NOT_READY")
    return attachmentCopy("Tệp chưa sẵn sàng.", mimeType);
}
