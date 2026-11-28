import type { MessageAttachment } from "../types";

export function isBlockedAttachment(file: MessageAttachment): boolean {
  const status = file.accessStatus ?? file.availability;
  return status === "REVOKED" || file.moderationStatus === "BLOCKED";
}

export function attachmentStatusMessage(
  file: MessageAttachment,
): string | null {
  if (isBlockedAttachment(file)) {
    return file.restrictionReason === "REVOKED"
      ? "Tệp đã bị kiểm duyệt viên thu hồi quyền tải."
      : "Tệp đã bị chặn do vi phạm tiêu chuẩn cộng đồng.";
  }
  const status = file.accessStatus ?? file.availability;
  if (!status || status === "AVAILABLE") return null;
  if (status === "PENDING_SCAN") {
    return "Đang kiểm tra an toàn tệp. Tệp sẽ mở tải sau khi hoàn tất.";
  }
  return "Tệp hiện không khả dụng.";
}

/**
 * Prevents leaking profane or unmoderated filenames in chat history:
 * - Blocked/revoked attachments never expose the original filename to anyone.
 * - Unapproved (pending/unavailable) attachments never expose raw filenames to recipients.
 */
export function visibleAttachmentFilename(
  file: MessageAttachment,
  mine: boolean,
): string {
  if (isBlockedAttachment(file)) {
    return file.restrictionReason === "REVOKED"
      ? "Tệp đính kèm đã bị thu hồi"
      : "Tệp đính kèm đã bị chặn";
  }
  const status = file.accessStatus ?? file.availability;
  if (!mine && status && status !== "AVAILABLE") {
    return status === "PENDING_SCAN"
      ? "Tệp đính kèm đang kiểm tra"
      : "Tệp đính kèm không khả dụng";
  }
  return file.filename;
}
