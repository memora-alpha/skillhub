import { connectionError } from "@/features/connections";
import { AppError } from "@/lib/http/errors";
const messages: Readonly<Record<string, string>> = {
  MATERIAL_STORAGE_QUOTA_EXCEEDED:
    "Dung lượng tài liệu vượt hạn mức gói. Hãy giải phóng dung lượng hoặc xem Gói thành viên trong Hồ sơ.",
  MATERIAL_DELETE_REQUIRES_DRAFT:
    "Chỉ có thể xóa tài liệu còn là bản nháp. Tải lại để kiểm tra trạng thái.",
  MATERIAL_DELETE_NOT_ALLOWED:
    "Chỉ có thể xóa bản nháp hoặc tài liệu đã ngừng chia sẻ. Tải lại để kiểm tra trạng thái.",
  MATERIAL_FILE_REMOVAL_UNSUPPORTED:
    "Chưa thể gỡ tệp nội dung đã lưu. Bạn có thể chọn tệp thay thế.",
  MATERIAL_REVIEW_NOT_ALLOWED:
    "Bạn chưa đủ điều kiện đánh giá. Tải lại để xem quyền hiện tại.",
  MATERIAL_REVIEW_VERSION_CONFLICT:
    "Đánh giá đã thay đổi. Tải lại trước khi chỉnh sửa.",
  MATERIAL_REVIEW_HIDDEN: "Đánh giá đang bị ẩn nên chưa thể chỉnh sửa.",
  MATERIAL_REVIEW_NOT_FOUND:
    "Đánh giá không còn khả dụng. Hãy tải lại danh sách.",
  MATERIAL_REVIEW_REPORT_EXISTS:
    "Bạn đã có báo cáo đang chờ xử lý cho đánh giá này.",
  MATERIAL_REVIEW_SELF_REPORT_FORBIDDEN:
    "Bạn không thể báo cáo đánh giá của mình.",
  MATERIAL_COVER_INVALID:
    "Ảnh bìa cần là ảnh tĩnh, ít nhất 640 × 360 px. Hãy chọn lại ảnh.",
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
  MATERIAL_ALREADY_REFUNDED: "Đơn mua đã được hoàn tiền.",
  MATERIAL_ENTITLEMENT_NOT_ACTIVE:
    "Quyền truy cập của đơn mua này không còn hiệu lực.",
  CREDIT_PROVENANCE_REVIEW_REQUIRED:
    "Yêu cầu hoàn tiền này cần nhân viên kiểm tra nguồn Credit.",
  MATERIAL_REFUND_ADMIN_REQUIRED:
    "Yêu cầu hoàn tiền này cần nhân viên xem xét.",
  MATERIAL_ACCESS_CHANGED:
    "Quyền truy cập đã thay đổi. Hãy kiểm tra lại đơn mua.",
  MATERIAL_NOT_EDITABLE: "Tài liệu hiện không thể chỉnh sửa.",
  MATERIAL_CONTENT_LOCKED:
    "Tài liệu đã từng được đăng nên không thể sửa nội dung, tệp, ảnh bìa hoặc giá. Hãy đăng tài liệu mới nếu cần thay đổi.",
  MATERIAL_VERSION_CONFLICT:
    "Thông tin tài liệu đã thay đổi. Tải lại và xác nhận trước khi thao tác.",
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
