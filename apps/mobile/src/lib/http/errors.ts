import type { SchedulingErrorDetails } from "./scheduling-error";
import { scheduleConflictMessage } from "./scheduling-error";
export class AppError extends Error {
  constructor(
    public readonly kind:
      "network" | "http" | "protocol" | "config" | "storage" | "session",
    public readonly status = 0,
    public readonly code = "",
    public readonly retryAt = 0,
    public readonly details?: SchedulingErrorDetails,
  ) {
    super(kind);
    this.name = "AppError";
  }
}

export const OTP_ERROR_MESSAGE =
  "Mã không đúng hoặc đã hết hạn. Nếu sai 5 lần, hãy thử lại sau 24 giờ.";

const messages: Record<string, string> = {
  MATERIAL_VERSION_CONFLICT:
    "Giá hoặc phiên bản tài liệu đã đổi. Tải lại và kiểm tra trước khi xác nhận.",
  MATERIAL_PRICE_CHANGED:
    "Giá hoặc phiên bản tài liệu đã đổi. Tải lại và kiểm tra trước khi xác nhận mua.",
  MATERIAL_ORDER_NOT_REFUNDABLE: "Đơn mua hiện không đủ điều kiện hoàn tiền.",
  INSUFFICIENT_AVAILABLE_CREDIT:
    "Số dư Credit khả dụng chưa đủ. Kiểm tra ví trước khi tiếp tục.",
  MATERIAL_ALREADY_OWNED: "Bạn đã có quyền truy cập tài liệu này.",
  MATERIAL_TRANSITION_INVALID:
    "Tài liệu đã đổi trạng thái. Tải lại danh sách trước khi thao tác.",
  MATERIAL_NOT_PURCHASABLE: "Tài liệu hiện không đủ điều kiện mua.",
  MATERIAL_FILE_REQUIRED: "Tài liệu cần có tệp hợp lệ trước khi gửi duyệt.",
  MATERIAL_REFUND_WINDOW_CLOSED:
    "Đã hết thời hạn hoàn tiền tự động cho đơn mua này.",
  MATERIAL_ALREADY_CONSUMED:
    "Tài liệu đã được cấp đường dẫn tải nên không thể hoàn tiền tự động.",
  FILE_NOT_READY:
    "Tệp chưa được quét an toàn xong. Kiểm tra trạng thái tệp trước khi gửi.",
  CHAT_RATE_LIMIT:
    "Bạn đang gửi tin nhắn quá nhanh. Vui lòng đợi trước khi gửi tiếp.",
  PROPOSAL_RATE_LIMIT: "Bạn đã đạt giới hạn gửi đề xuất. Vui lòng thử lại sau.",
  DIRECT_INVITATION_COOLDOWN:
    "Bạn đã gửi lời mời cho người này với kỹ năng này gần đây. Vui lòng thử lại sau.",
  EVENT_CONNECTION_LIMIT:
    "Đã đạt giới hạn kết nối cập nhật. Đóng bớt phiên đang mở và đợi kết nối lại.",
  INVALID_CREDENTIALS: "Email hoặc mật khẩu chưa đúng.",
  ACCOUNT_NOT_ACTIVE:
    "Tài khoản hiện chưa thể đăng nhập. Vui lòng liên hệ hỗ trợ SkillHub để kiểm tra trạng thái tài khoản.",
  OTP_INVALID_OR_EXPIRED: OTP_ERROR_MESSAGE,
  RESET_TOKEN_INVALID_OR_EXPIRED:
    "Phiên đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu mã mới.",
  INVALID_REFRESH_TOKEN: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
};

export function errorMessage(error: unknown): string {
  if (!(error instanceof AppError))
    return "Không thể hoàn tất. Vui lòng thử lại.";
  if (error.code === "SCHEDULE_CONFLICT")
    return (
      scheduleConflictMessage(error) ??
      "Thời gian đề xuất bị trùng lịch. Hãy chọn giờ khác."
    );
  const message = messages[error.code];
  if (message) return message;
  if (error.kind === "network")
    return "Không thể kết nối. Kiểm tra mạng và thử lại.";
  if (error.kind === "config") return "Chưa cấu hình địa chỉ máy chủ hợp lệ.";
  if (error.kind === "storage")
    return "Không thể lưu phiên đăng nhập an toàn trên thiết bị.";
  if (error.kind === "session")
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (error.status === 429)
    return "Tạm thời có nhiều yêu cầu. Vui lòng đợi một lát.";
  if (error.status === 400)
    return "Thông tin chưa hợp lệ. Kiểm tra lại và thử lại.";
  if (error.status === 403)
    return "Tài khoản hiện không có quyền thực hiện thao tác này.";
  return "Không thể hoàn tất. Vui lòng thử lại.";
}
