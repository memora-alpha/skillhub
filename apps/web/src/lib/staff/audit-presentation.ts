import { knownSystemMessage } from "@/lib/system-text";

/** Display copy only; retain the original values for exact-match API filters. */
export const auditActionLabels: Readonly<Record<string, string>> = {
  TAG_CREATE: "Tạo thẻ chủ đề",
  TAG_UPDATE: "Cập nhật thẻ chủ đề",
  TAG_REQUEST_CREATE: "Đề xuất thẻ chủ đề",
  TAG_REQUEST_APPROVE: "Duyệt thẻ chủ đề",
  TAG_REQUEST_REJECT: "Từ chối thẻ chủ đề",
  SKILL_LEVEL_UPDATE: "Cập nhật cấp độ kỹ năng",
  PROPOSAL_CREATE: "Gửi đề nghị kết nối",
  PROPOSAL_UPDATE: "Cập nhật đề nghị kết nối",
  PROPOSAL_DECIDE: "Xử lý đề nghị kết nối",
  SKILL_CATALOG_CREATE: "Thêm kỹ năng vào danh mục",
  SKILL_CATALOG_UPDATE: "Cập nhật kỹ năng trong danh mục",
  SKILL_CATALOG_ARCHIVE: "Lưu trữ kỹ năng trong danh mục",
  SKILL_CATALOG_RESTORE: "Khôi phục kỹ năng trong danh mục",
  SHARING_SKILL_RESTORE: "Khôi phục kỹ năng chia sẻ",
  USER_LOCK: "Khóa tài khoản",
  USER_UNLOCK: "Mở khóa tài khoản",
  ACCOUNT_LOCKED: "Khóa tài khoản",
  ACCOUNT_UNLOCKED: "Mở khóa tài khoản",
  USER_SUSPEND: "Tạm ngưng tài khoản",
  VERIFY_SKILL_APPROVE: "Duyệt xác minh kỹ năng",
  VERIFY_SKILL_REJECT: "Từ chối xác minh kỹ năng",
  VERIFY_SKILL_REVOKE: "Thu hồi xác minh kỹ năng",
  LEARNING_REQUEST_MODERATE: "Kiểm duyệt nhu cầu học",
  ROLE_PERMISSION_CHANGE: "Thay đổi vai trò và quyền",
  DISPUTE_RESOLVE: "Giải quyết tranh chấp",
  REPORT_CASE_UPDATE: "Cập nhật xử lý báo cáo",
  REPORT_EVIDENCE_READ: "Xem bằng chứng báo cáo",
  REPUTATION_ADJUST: "Điều chỉnh điểm uy tín",
  REPUTATION_EVENT_REVERSE: "Hoàn tác thay đổi điểm uy tín",
  USER_RESTRICTION_APPLY: "Áp dụng hạn chế tài khoản",
  USER_RESTRICTION_REVOKE: "Gỡ hạn chế tài khoản",
  USER_RESTRICTION_REVIEW: "Xem xét hạn chế tài khoản",
  SCHEDULE_RESCHEDULE: "Đổi lịch buổi học",
  PATH_SETTLEMENT_CONSENT: "Đồng ý quyết toán lộ trình",
  LEARNING_CHANGE_UPDATE: "Cập nhật yêu cầu thay đổi lộ trình",
  CREDIT_ADJUST: "Điều chỉnh Credit",
  CREDIT_TOP_UP: "Ghi nhận nạp Credit",
  PAYMENT_RECOVERY_RESUME: "Tiếp tục xử lý thanh toán",
  CREDIT_REVERSE: "Hoàn tác giao dịch Credit",
  SYSTEM_CONFIGURATION_UPDATE: "Cập nhật cấu hình hệ thống",
  MATERIAL_MODERATE: "Kiểm duyệt tài liệu",
  MATERIAL_PURCHASE: "Mua tài liệu",
  MATERIAL_REFUND: "Hoàn Credit mua tài liệu",
  MATERIAL_REVIEW_CREATE: "Gửi đánh giá tài liệu",
  MATERIAL_REVIEW_UPDATE: "Chỉnh sửa đánh giá tài liệu",
  MATERIAL_REVIEW_DELETE: "Xóa đánh giá tài liệu",
  MATERIAL_REVIEW_REPORT: "Báo cáo đánh giá tài liệu",
  MATERIAL_REVIEW_MODERATE: "Kiểm duyệt đánh giá tài liệu",
  ADMIN_WORK_ITEM_READ: "Xem chi tiết công việc quản trị",
  ADMIN_LEARNING_PATH_READ: "Xem chi tiết lộ trình học",
  ADMIN_BOOTSTRAP: "Khởi tạo tài khoản quản trị",
  STAFF_CREATED: "Tạo tài khoản nhân viên",
  STAFF_ASSIGNED: "Cấp vai trò nhân viên",
  STAFF_REMOVED: "Gỡ vai trò nhân viên",
  STAFF_PERMISSION_CHANGE: "Thay đổi quyền nhân viên",
  PROFILE_HIDE: "Ẩn nội dung hồ sơ",
  PROFILE_REQUEST_EDIT: "Yêu cầu chỉnh sửa hồ sơ",
  REVIEW_HIDE: "Ẩn đánh giá",
  REVIEW_RESTORE: "Khôi phục đánh giá",
  EMAIL_VERIFIED: "Xác minh email",
  PASSWORD_RESET: "Đặt lại mật khẩu",
  MATERIAL_FEE_POLICY_CREATE: "Tạo chính sách phí tài liệu",
  MATERIAL_FEE_POLICY_APPROVE: "Duyệt chính sách phí tài liệu",
};

export const auditTargetLabels: Readonly<Record<string, string>> = {
  USER: "Người dùng",
  REPORT_CASE: "Báo cáo",
  REPORT_INCIDENT: "Vụ việc chung",
  REPORT_EVIDENCE: "Bằng chứng báo cáo",
  LEARNING_PATH: "Lộ trình học",
  LEARNING_CHANGE: "Yêu cầu thay đổi lộ trình",
  PATH_TERMINATION: "Yêu cầu dừng lộ trình",
  SESSION: "Buổi học",
  SESSION_RESCHEDULE: "Yêu cầu đổi lịch",
  SCHEDULE: "Lịch học",
  LEARNING_REQUEST: "Nhu cầu học",
  PROPOSAL: "Đề nghị kết nối",
  SHARING_SKILL: "Kỹ năng chia sẻ",
  SKILL: "Kỹ năng",
  SKILL_VERIFICATION: "Xác minh kỹ năng",
  SKILL_LEVEL: "Cấp độ kỹ năng",
  TAG: "Thẻ chủ đề",
  TAG_REQUEST: "Đề xuất thẻ chủ đề",
  MATERIAL: "Tài liệu",
  MATERIAL_ORDER: "Đơn mua tài liệu",
  MATERIAL_REVIEW: "Đánh giá tài liệu",
  MATERIAL_REVIEW_REPORT: "Báo cáo đánh giá tài liệu",
  MATERIAL_FEE_POLICY: "Chính sách phí tài liệu",
  CREDIT_OPERATION: "Nghiệp vụ Credit",
  CREDIT_TRANSACTION: "Giao dịch Credit",
  PAYMENT: "Thanh toán",
  PAYMENT_REVIEW: "Thanh toán cần kiểm tra",
  SETTLEMENT_REVIEW: "Quyết toán cần kiểm tra",
  REPUTATION_EVENT: "Thay đổi điểm uy tín",
  USER_RESTRICTION: "Hạn chế tài khoản",
  SYSTEM_CONFIGURATION: "Cấu hình hệ thống",
  ROLE: "Vai trò",
  PERMISSION: "Quyền truy cập",
  REVIEW: "Đánh giá",
};

export function normalizeAuditCode(value: string) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase();
}
export function auditActionLabel(value: string) {
  return auditActionLabels[normalizeAuditCode(value)] ?? "Thao tác khác";
}
export function auditTargetLabel(value: string) {
  return auditTargetLabels[normalizeAuditCode(value)] ?? "Đối tượng khác";
}
export function auditRoleLabel(value: string) {
  return (
    (
      {
        ADMIN: "Quản trị viên",
        STAFF: "Nhân viên",
        USER: "Thành viên",
      } as Record<string, string>
    )[normalizeAuditCode(value)] ?? "Vai trò khác"
  );
}

/** Only link IDs to screens that actually accept that object's ID. */
export function auditTargetHref(type: string, id: string) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) return null;
  switch (normalizeAuditCode(type)) {
    case "REPORT_CASE":
      return `/admin/disputes/${id}`;
    case "LEARNING_PATH":
      return `/admin/learning-paths/${id}`;
    default:
      return null;
  }
}

const reasonLabels: Readonly<Record<string, string>> = {
  "Admin work item detail read":
    "Quản trị viên xem chi tiết công việc cần xử lý.",
  "Admin learning path detail read": "Quản trị viên xem chi tiết lộ trình học.",
  "Staff accessed report evidence": "Nhân sự đã xem bằng chứng của báo cáo.",
  "Participant approved immediate final settlement":
    "Người tham gia đồng ý quyết toán ngay.",
  "Both participants agreed to terminate": "Hai bên đồng ý dừng lộ trình.",
  "Verified exact payOS payment":
    "Đã đối chiếu và xác nhận thanh toán khớp với payOS.",
  "Resume technical review after verified payOS lookup":
    "Tiếp tục kiểm tra sau khi đối chiếu thanh toán với payOS.",
  "Connection proposal expired": "Đề nghị kết nối đã hết hạn.",
  "Connection proposal created": "Người dùng gửi đề nghị kết nối.",
  "Tag created": "Đã tạo thẻ chủ đề.",
  "Tag requested": "Người dùng đề xuất thẻ chủ đề.",
  "Tag request approved": "Đã duyệt đề xuất thẻ chủ đề.",
  "Catalog skill created": "Đã thêm kỹ năng vào danh mục.",
  "Owner restored sharing skill": "Chủ hồ sơ khôi phục kỹ năng chia sẻ.",
  "Reschedule confirmed by both participants":
    "Hai bên đã xác nhận lịch học mới.",
  "Material purchase": "Người dùng mua tài liệu.",
};
export function auditReasonText(reason: string | null) {
  if (!reason?.trim()) return "Không có ghi chú";
  // Free-text decisions are evidence: never rewrite a user's own explanation.
  return reasonLabels[reason] ?? knownSystemMessage(reason) ?? reason;
}

export function auditFilterOptions(
  labels: Readonly<Record<string, string>>,
  seen: string[],
) {
  return [...new Set([...Object.keys(labels), ...seen])]
    .map((value) => ({
      value,
      label:
        (labels[normalizeAuditCode(value)] ?? "Thông tin khác") +
        (value !== normalizeAuditCode(value) ? " (dữ liệu cũ)" : ""),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));
}
