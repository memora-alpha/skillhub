import { connectionError } from "@/features/connections";
import { AppError } from "@/lib/http/errors";
const messages: Readonly<Record<string, string>> = {
  MATERIAL_PRICE_CHANGED:
    "Giá tài liệu đã thay đổi. Tải lại và xác nhận giá mới trước khi mua.",
  INSUFFICIENT_AVAILABLE_CREDIT:
    "Credit khả dụng chưa đủ để mua tài liệu. Hãy kiểm tra ví Credit.",
  MATERIAL_NOT_PUBLISHED:
    "Tài liệu hiện không được phân phối. Bạn có thể quay lại thư viện hoặc khám phá tài liệu khác.",
  MATERIAL_ACCESS_DENIED:
    "Bạn chưa có quyền mở tài liệu này. Hãy kiểm tra đơn mua.",
  MATERIAL_REFUND_WINDOW_CLOSED: "Đơn mua đã quá thời hạn hoàn tiền 24 giờ.",
  MATERIAL_ALREADY_CONSUMED:
    "Đã cấp đường dẫn tải cho đơn mua này nên không còn đủ điều kiện hoàn tiền tự động.",
  MATERIAL_ORDER_NOT_REFUNDABLE: "Đơn mua này không thể hoàn tiền.",
  MATERIAL_REFUND_ADMIN_REQUIRED:
    "Yêu cầu hoàn tiền này cần nhân viên xem xét.",
  MATERIAL_ACCESS_CHANGED:
    "Quyền truy cập đã thay đổi. Hãy kiểm tra lại đơn mua.",
  MATERIAL_NOT_EDITABLE: "Tài liệu hiện không thể chỉnh sửa.",
  MATERIAL_VERSION_CONFLICT:
    "Thông tin tài liệu đã thay đổi. Tải lại trước khi lưu.",
  MATERIAL_TRANSITION_INVALID:
    "Trạng thái tài liệu đã thay đổi. Tải lại trước khi thao tác.",
  MATERIAL_RIGHTS_CONFIRMATION_REQUIRED:
    "Cần xác nhận quyền phân phối nội dung này.",
  MATERIAL_NOT_PAID: "Tài liệu hiện không thu phí. Hãy mở lại trang chi tiết.",
  MATERIAL_FILE_REQUIRED: "Tài liệu chưa có tệp an toàn để sử dụng.",
  MATERIAL_FEE_POLICY_UNAVAILABLE:
    "Chưa thể thanh toán tài liệu lúc này. Vui lòng thử lại sau.",
};
export function materialFailure(error: unknown) {
  if (error instanceof AppError && Object.hasOwn(messages, error.code))
    return messages[error.code]!;
  return connectionError(error);
}
