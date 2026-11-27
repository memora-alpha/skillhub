import { attachmentCopy } from "./chat-attachment-kind";

// Resolve by code when rendering so saved failures also use the current wording.
const messages: Record<string, string> = {
  CHAT_FILE_REVOKED: "Tệp chứa nội dung không phù hợp.",
  CHAT_FILE_REMOTE_UNAVAILABLE: "Không mở được tệp.",
  CHAT_FILE_REJECTED: "Không gửi được tệp do nội dung không phù hợp.",
  CHAT_FILE_BLOCKED: "Không gửi được tệp do nội dung không phù hợp.",
  CHAT_FILE_UPLOAD_RESTART_REQUIRED:
    "Không thể tiếp tục lần tải này. Chọn lại tệp.",
  CHAT_UPLOAD_IN_PROGRESS: "Tệp đang được tải lên. Thử lại sau.",
  CHAT_FILE_REVIEW_REQUIRED: "Tệp cần kiểm tra thêm.",
  CHAT_FILE_SCAN_FAILED: "Không kiểm tra được tệp.",
  CHAT_FILE_FAILED: "Không kiểm tra được tệp.",
  CHAT_FILE_DELETED: "Tệp không còn tồn tại.",
  CHAT_FILE_CLEANUP_PENDING: "Tệp không còn dùng được.",
  CHAT_FILE_UPLOAD_FAILED: "Không tải được tệp lên.",
  CHAT_FILE_UNAVAILABLE: "Không đọc được tệp.",
  CHAT_ATTACHMENT_INTERRUPTED: "Không gửi được.",
  CHAT_ATTACHMENT_TIMEOUT: "Chưa xác nhận được tệp đã gửi.",
  CHAT_ATTACHMENT_PENDING: "Tệp chưa sẵn sàng.",
  CHAT_ATTACHMENT_RETRYABLE: "Không kiểm tra được tệp. Có thể thử lại.",
  CHAT_OUTBOX_STORAGE_UNAVAILABLE: "Không gửi được.",
  FILE_NOT_READY: "Tệp chưa sẵn sàng.",
  FILE_FORMAT_UNSUPPORTED: "Không đọc được tệp.",
  FILE_FORMAT_MISMATCH: "Tệp sai định dạng.",
  FILE_TOO_LARGE: "Tệp vượt quá 15 MB.",
  FILE_EMPTY_OR_INVALID: "Không đọc được tệp.",
  FILE_OBJECT_MISMATCH: "Tệp tải lên bị lỗi.",
  FILE_NAME_INVALID: "Tên tệp không hợp lệ.",
  FILE_STORAGE_UNAVAILABLE: "Không gửi được.",
  FILE_POLICY_UNAVAILABLE: "Không gửi được.",
  CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE: "Không gửi được.",
};

export function chatFailureCopy(code?: string, mimeType?: string) {
  const copy = code ? messages[code] : undefined;
  return copy ? attachmentCopy(copy, mimeType) : undefined;
}
