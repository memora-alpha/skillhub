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
  "Mã không đúng, đã hết hạn hoặc đang bị giới hạn. Sai 5 lần có thể bị chặn OTP 24 giờ; gửi lại mã không gỡ giới hạn. Mật khẩu hợp lệ vẫn dùng để đăng nhập được.";

const messages: Record<string, string> = {
  SESSION_MAKEUP_LIMIT_REACHED:
    "Buổi này đã dùng lượt học bù; cần nhân sự xem xét nếu còn vấn đề.",
  USER_MAKEUP_LIMIT_REACHED:
    "Người yêu cầu đã hết lượt học bù trong thỏa thuận.",
  MAKEUP_ATTRIBUTION_REVIEW_REQUIRED:
    "Lịch sử học bù cần nhân sự xác minh người sử dụng lượt.",
  SESSION_RESCHEDULE_LIMIT_REACHED: "Buổi này đã đổi lịch đủ 3 lần.",
  RESCHEDULE_SESSION_ORDER_VIOLATION:
    "Giờ mới phải giữ đúng thứ tự các buổi trong kế hoạch.",
  LAST_SESSION_RESCHEDULE_WINDOW_EXCEEDED:
    "Buổi cuối chỉ được dời tối đa 48 giờ so với lịch gốc.",
  SESSION_CANNOT_BE_CANCELLED:
    "Buổi đã bắt đầu hoặc không còn đủ điều kiện hủy để học bù.",
  CHANGE_REQUEST_ALREADY_PENDING:
    "Đã có yêu cầu đang chờ xử lý. Tải lại lịch sử yêu cầu.",
  CHANGE_REQUEST_EXPIRED:
    "Yêu cầu đã hết hạn. Kiểm tra lịch hiện tại trên máy chủ.",
  STALE_SESSION_OCCURRENCE:
    "Giờ buổi học đã đổi. Tải lại trước khi gửi yêu cầu.",
  STALE_CHANGE_REQUEST_VERSION:
    "Yêu cầu đã được cập nhật. Tải lại để xem phản hồi mới.",
  SETTLEMENT_STATE_CHANGED:
    "Điều kiện hoặc phiên bản quyết toán đã đổi. Tải lại trước khi đồng ý.",
  SETTLEMENT_BLOCKED_BY_TERMINATION:
    "Đang xử lý yêu cầu dừng nên chưa thể quyết toán lộ trình.",
  EMAIL_ALREADY_EXISTS:
    "Email đã được sử dụng. Hãy đăng nhập hoặc khôi phục mật khẩu.",
  EMAIL_ALREADY_REGISTERED:
    "Email đã được sử dụng. Hãy đăng nhập hoặc khôi phục mật khẩu.",
  NEW_ACTIVITY_RESTRICTED:
    "Tài khoản đang bị hạn chế tạo bài hoặc đề xuất mới. Xem mục Uy tín để biết lý do và thời hạn; bạn vẫn có thể theo dõi hoạt động đã có quyền truy cập.",
  ACTIVE_SESSION_REPORT_EXISTS:
    "Bạn đã có báo cáo đang xử lý cho buổi này. Mở danh sách báo cáo để theo dõi.",
  ACTIVE_MATERIAL_REPORT_EXISTS:
    "Bạn đã có báo cáo đang xử lý cho tài liệu này.",
  DISPUTE_WINDOW_CLOSED: "Đã hết thời hạn gửi báo cáo buổi học.",
  DISPUTE_WINDOW_OPEN:
    "Chưa hết thời hạn khiếu nại. Hãy kiểm tra quyết toán sau thời hạn này.",
  SETTLEMENT_BLOCKED_BY_DISPUTE:
    "Lộ trình đang có tranh chấp cần xử lý trước khi quyết toán.",
  PATH_SESSIONS_INCOMPLETE:
    "Cần hoàn thành tất cả buổi học trước khi quyết toán.",
  MATERIAL_VERSION_CONFLICT:
    "Giá hoặc phiên bản tài liệu đã đổi. Tải lại và kiểm tra trước khi xác nhận.",
  MATERIAL_PRICE_CHANGED:
    "Giá hoặc phiên bản tài liệu đã đổi. Tải lại và kiểm tra trước khi xác nhận mua.",
  MATERIAL_ORDER_NOT_REFUNDABLE: "Đơn mua hiện không đủ điều kiện hoàn tiền.",
  INSUFFICIENT_AVAILABLE_CREDIT:
    "Số dư Credit khả dụng chưa đủ. Kiểm tra ví trước khi tiếp tục.",
  MATERIAL_ALREADY_OWNED: "Bạn đã có quyền truy cập tài liệu này.",
  PATH_ALREADY_LEARNING_FINISHED:
    "Các buổi học đã hoàn thành. Mở quyết toán để theo dõi Credit.",
  CASE_HANDLER_REQUIRED:
    "Vụ việc chưa có người xử lý. Bạn có thể gửi thông tin khi nhân viên tiếp nhận.",
  REPORT_CASE_CLOSED: "Vụ việc đã đóng. Bạn vẫn có thể xem lại trao đổi.",
  CASE_EVIDENCE_LIMIT: "Bạn đã gửi đủ 5 bằng chứng cho vụ việc này.",
  CASE_MESSAGE_ID_REUSED:
    "Nội dung gửi lại đã thay đổi. Tải lại trao đổi để kiểm tra.",
  RECOVERY_MISSION_INCOMPLETE:
    "Nhiệm vụ chưa đủ điều kiện. Hoàn thành các bước rồi kiểm tra lại.",
  RECOVERY_MISSION_NOT_ELIGIBLE:
    "Nhiệm vụ này không còn áp dụng cho tài khoản của bạn. Hãy cập nhật uy tín.",
  RECOVERY_QUIZ_VERSION_OR_LENGTH_INVALID:
    "Bài kiểm tra đã cập nhật. Tải lại câu hỏi để làm tiếp.",
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
