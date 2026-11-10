import { systemLabels } from "../../../../packages/content/system-labels";
/** Presentation only: API codes and submitted values must remain unchanged. */
const labels: Readonly<Record<string, string>> = {
  ...systemLabels,
  INVALID_FEE_REPORT_RANGE:
    "Khoảng báo cáo chưa hợp lệ. Chọn ngày kết thúc từ ngày bắt đầu và tối đa 366 ngày.",
  INVALID_FEE_TIMESTAMP: "Ngày giờ chưa hợp lệ. Vui lòng chọn lại thời điểm.",
  INVALID_MATERIAL_FEE_POLICY:
    "Phiên bản phải là số nguyên dương, mức phí từ 0% đến 99,99%.",
  FEE_POLICY_NOT_FOUND:
    "Không tìm thấy chính sách phí. Tải lại danh sách để kiểm tra.",
  FEE_POLICY_ALREADY_DECIDED:
    "Phiên bản này đã được duyệt hoặc không còn là bản nháp. Tải lại danh sách.",
  FEE_POLICY_EFFECTIVE_ORDER_CONFLICT:
    "Thời điểm hiệu lực không khớp thứ tự phiên bản. Kiểm tra các phiên bản đã duyệt.",
  STALE_PROFILE_VERSION:
    "Hồ sơ vừa được cập nhật. Tải lại để xem nội dung mới nhất trước khi kiểm duyệt.",
  STALE_REVIEW_VERSION:
    "Đánh giá vừa được cập nhật. Tải lại trước khi xác nhận quyết định.",
  PROFILE_MODERATION_REQUIRED: "Bạn chưa được cấp quyền kiểm duyệt hồ sơ.",
  REVIEW_MODERATION_REQUIRED: "Bạn chưa được cấp quyền kiểm duyệt đánh giá.",
  PAYMENT_CHECKOUT_MISSING: "Đơn chưa có thông tin thanh toán.",
  PAYMENT_REVIEW_REQUIRED: "Thanh toán cần được kiểm tra thêm.",
  PAYMENT_CREATION_IDENTITY_MISSING:
    "Thiếu thông tin đối chiếu yêu cầu tạo thanh toán.",
  PAYMENT_HTTP_MAPPING_MISSING_OR_MISMATCHED:
    "Thông tin liên kết yêu cầu thanh toán bị thiếu hoặc không khớp.",
  PAYMENT_TOP_UP_LINK_MISMATCH:
    "Liên kết giữa thanh toán và nghiệp vụ nạp Credit chưa khớp.",
  TOP_UP_WITHOUT_PAID_PAYMENT:
    "Đã có nghiệp vụ nạp Credit nhưng thanh toán chưa được ghi nhận thành công.",
  PAYMENT_LEDGER_OR_LOT_MISMATCH:
    "Sổ giao dịch hoặc dữ liệu Credit nạp chưa khớp.",
  PAYMENT_PROVIDER_LINK_MISMATCH:
    "Thông tin thanh toán chưa khớp với nhà cung cấp.",
  PROVIDER_PAID_NOT_POSTED:
    "Nhà cung cấp đã ghi nhận trả tiền nhưng hệ thống chưa ghi nhận nạp Credit.",
};

export function systemCodeLabel(
  code: string,
  fallback = "Thông tin đang được cập nhật",
) {
  return Object.hasOwn(labels, code) ? labels[code]! : fallback;
}

/** Translate system-generated descriptions; preserve participants' own wording. */
export function reportDescriptionText(description: string) {
  if (Object.hasOwn(labels, description)) return labels[description]!;
  if (
    description ===
    "Attendance could not be verified and neither participant confirmed completion."
  )
    return "Không thể xác minh việc tham gia buổi học và chưa bên nào xác nhận hoàn thành.";
  if (description === "No makeup time was agreed before the makeup deadline.")
    return "Hai bên chưa thống nhất lịch học bù trước khi hết hạn.";
  return description;
}

export function knownSystemMessage(code: string) {
  return Object.hasOwn(labels, code) ? labels[code] : undefined;
}
