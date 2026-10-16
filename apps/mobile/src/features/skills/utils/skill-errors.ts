import { AppError, errorMessage } from "@/lib/http/errors";
const messages: Record<string, string> = {
  SKILL_DUPLICATE: "Kỹ năng này đã có trong hồ sơ. Hãy kiểm tra danh sách.",
  STALE_VERSION: "Dữ liệu đã thay đổi. Tải bản mới và xem lại trước khi lưu.",
  VERIFICATION_PENDING:
    "Kỹ năng đang có yêu cầu chờ duyệt. Hãy kiểm tra lịch sử xác minh.",
  SHARING_SKILL_ARCHIVED: "Kỹ năng đã bị xóa khỏi hồ sơ.",
  FILE_NOT_READY: "File chưa sẵn sàng. Kiểm tra trạng thái trước khi gửi.",
  SKILL_NOT_ACTIVE: "Kỹ năng không còn có thể chọn. Hãy chọn lại từ danh mục.",
  SKILL_LEVEL_NOT_ACTIVE:
    "Trình độ không còn hoạt động. Tải lại và chọn trình độ khác.",
  SKILL_LEVEL_NOT_FOUND:
    "Trình độ không thuộc kỹ năng này hoặc không còn khả dụng.",
};
export function outcomeUnknown(error: unknown) {
  return (
    error instanceof AppError &&
    (error.kind === "network" ||
      error.status >= 500 ||
      error.kind === "protocol")
  );
}
export function skillError(error: unknown, saving = false) {
  if (saving && outcomeUnknown(error))
    return "Chưa xác nhận được kết quả. Kiểm tra dữ liệu đã lưu trước khi thử lại.";
  if (error instanceof AppError) {
    if (messages[error.code]) return messages[error.code]!;
    if (error.status === 409)
      return "Thao tác xung đột với dữ liệu hiện tại. Kiểm tra và tải lại dữ liệu.";
    if (error.status === 404) return "Kỹ năng hoặc bằng chứng không khả dụng.";
    if (error.status === 413)
      return "File vượt giới hạn máy chủ. Chọn file nhỏ hơn.";
    if (error.status === 415)
      return "Định dạng hoặc nội dung file không được hỗ trợ.";
    if (error.status === 503)
      return "Máy chủ chưa sẵn sàng xử lý yêu cầu. Hãy thử lại sau.";
  }
  return errorMessage(error);
}
