import { ConnectionFeedback } from "@/features/connections";
import { FormNotice } from "@/components/FormNotice";
import { AppError } from "@/lib/http/errors";

const messages: Record<string, string> = {
  TERMINATION_ALREADY_APPROVED:
    "Yêu cầu đã được duyệt, không thể rút hoặc chuyển nhân viên. Tải lại để xem Credit.",
  TERMINATION_USE_FINAL_SETTLEMENT:
    "Các buổi đã hoàn tất. Về bước Hoàn tất của lộ trình để xem quyết toán.",
  STALE_PATH_VERSION:
    "Phiên bản thỏa thuận đã thay đổi. Tải lại trước khi đồng ý quyết toán.",
  SETTLEMENT_CONSENT_NOT_ALLOWED:
    "Hiện chưa thể đồng ý quyết toán sớm. Tải lại trạng thái và kiểm tra yêu cầu dừng hoặc tranh chấp.",
  SETTLEMENT_BLOCKED_BY_TERMINATION:
    "Yêu cầu dừng lộ trình đang giữ quyết toán. Xử lý yêu cầu đó trước khi tiếp tục.",
  SETTLEMENT_BLOCKED_BY_DISPUTE:
    "Tranh chấp đang giữ quyết toán. Cần giải quyết báo cáo trước.",
  PATH_SESSIONS_INCOMPLETE:
    "Tất cả buổi học cần hoàn thành trước khi đồng ý quyết toán sớm.",
  LEARNING_PATH_NOT_SETTLEABLE:
    "Lộ trình hiện chưa đủ điều kiện quyết toán. Tải lại trạng thái.",
  CHANGE_REQUEST_ALREADY_PENDING:
    "Đã có yêu cầu đang xử lý. Tải lại danh sách để xem.",
  CHANGE_REQUEST_KEY_CONFLICT:
    "Nội dung khác lần gửi trước. Tải lại yêu cầu trước khi tiếp tục.",
  STALE_CHANGE_REQUEST_VERSION:
    "Yêu cầu đã được cập nhật. Tải lại và xem phiên bản mới trước khi phản hồi.",
  CHANGE_REQUEST_EXPIRED: "Yêu cầu đã hết hạn. Tải lại để xem trạng thái mới.",
  CHANGE_REQUEST_CLOSED: "Yêu cầu đã đóng. Tải lại để xem kết quả.",
  CHANGE_REQUEST_ALREADY_DECIDED: "Đã có phản hồi cho yêu cầu. Tải lại để xem.",
  LEARNING_PATH_CANNOT_BE_CHANGED:
    "Trạng thái hiện tại không cho phép yêu cầu dừng. Tải lại lộ trình.",
  TERMINATION_POLICY_NOT_APPROVED:
    "Đang chờ chính sách xử lý Credit được duyệt.",
  TERMINATION_BLOCKED_BY_DISPUTE:
    "Cần giải quyết tranh chấp trước khi thực hiện quyết định dừng.",
  PARTNER_DECISION_REQUIRED: "Chỉ đối tác mới được phản hồi yêu cầu này.",
  CHANGE_REQUEST_OWNER_REQUIRED: "Chỉ người gửi mới được rút yêu cầu.",
};
export function TerminationFeedback({ error }: Readonly<{ error: unknown }>) {
  if (error instanceof AppError && messages[error.code])
    return (
      <FormNotice tone="error" compact>
        {messages[error.code]}
      </FormNotice>
    );
  return <ConnectionFeedback error={error} errorTone="error" />;
}
