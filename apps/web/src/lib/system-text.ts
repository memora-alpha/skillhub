/** Presentation only: API codes and submitted values must remain unchanged. */
const labels: Readonly<Record<string, string>> = {
  BEGINNER: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
  EXPERT: "Chuyên gia",
  NONE: "Chưa có nền tảng",
  RECOVERY_REWARD_REVOKED: "Thu hồi thưởng phục hồi uy tín",
  PAYMENT: "Thanh toán",
  DISPUTE: "Tranh chấp",
  MATERIAL_ORDER: "Đơn tài liệu",
  SYSTEM: "Hệ thống",
  TOP_UP: "Nạp Credit",
  DAILY_BONUS: "Thưởng hằng ngày",
  FEEDBACK_BONUS: "Thưởng phản hồi",
  HOLD: "Tạm giữ Credit",
  RELEASE: "Giải phóng Credit",
  PATH_RETURN: "Hoàn Credit lộ trình",
  PLATFORM_FEE: "Phí nền tảng",
  TEACHING_PAYMENT: "Thanh toán giảng dạy",
  TEACHING_EARNING: "Thu nhập giảng dạy",
  MATERIAL_PURCHASE: "Mua tài liệu",
  MATERIAL_SALE: "Bán tài liệu",
  REFUND: "Hoàn Credit",
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
  PENALTY: "Khấu trừ",
  ADJUSTMENT: "Điều chỉnh",
  SUCCESS: "Thành công",
  FAILED: "Không thành công",
  REVERSED: "Đã hoàn tác",
  ATTENDANCE_UNVERIFIABLE: "Không thể xác minh việc tham gia buổi học",
  MAKEUP_LIMIT_REACHED: "Đã hết lượt học bù",
  SESSION_MAKEUP_LIMIT_REACHED: "Buổi học đã dùng hết lượt học bù",
  USER_MAKEUP_LIMIT_REACHED: "Người tham gia đã hết lượt học bù trong lộ trình",
  MAKEUP_ATTRIBUTION_REVIEW_REQUIRED:
    "Cần xác minh người đã sử dụng lượt học bù",
  MAKEUP_EXPIRED: "Đã quá hạn chốt lịch học bù",
  NO_SHOW_LATE: "Vắng học hoặc đến muộn",
  NO_SHOW: "Vắng buổi học",
  TECHNICAL_ISSUE: "Sự cố kỹ thuật",
  INAPPROPRIATE_BEHAVIOR: "Hành vi không phù hợp",
  HARASSMENT: "Quấy rối",
  SKILL_MISMATCH: "Kỹ năng không đúng thỏa thuận",
  FALSE_INFORMATION: "Thông tin sai lệch",
  CREDIT_ISSUE: "Vấn đề Credit",
  INAPPROPRIATE_CONTENT: "Nội dung không phù hợp",
  SPAM_SCAM: "Tin rác hoặc lừa đảo",
  SPAM: "Tin rác",
  OTHER: "Vấn đề khác",
  LATE_CANCELLATION: "Hủy buổi học muộn",
  LIGHT_VIOLATION: "Vi phạm nhẹ",
  MEDIUM_HARASSMENT: "Vi phạm quấy rối",
  FRAUD: "Gian lận",
  PRESENT: "Có mặt",
  ABSENT: "Vắng mặt",
  UNVERIFIABLE: "Chưa xác minh được",
  BOTH_PRESENT: "Cả hai có mặt",
  BOTH_ABSENT: "Cả hai vắng mặt",
  TEACHER_ABSENT: "Người dạy vắng mặt",
  LEARNER_ABSENT: "Người học vắng mặt",
  PROVISIONAL: "Kết quả tạm thời",
  FINAL: "Đã chốt kết quả",
  EXCUSED: "Đã chấp thuận lý do vắng học",
  OVERTURNED: "Đã thay đổi kết luận",
  STAFF_REVIEW: "Chờ nhân viên xem xét",
  MAKEUP_REQUIRED: "Cần học bù",
  COMPLETED_MUTUAL: "Hai bên đã xác nhận hoàn thành",
  COMPLETED_TIMEOUT: "Hoàn thành sau thời hạn xác nhận",
  COMPLETED_STAFF: "Hoàn thành theo quyết định của nhân viên",
  COMPLETED_LEARNER_NO_SHOW: "Đã chốt buổi học do người học vắng mặt",
  STAFF_RESOLVED: "Nhân viên đã giải quyết",
  STAFF_REJECTED: "Nhân viên đã từ chối",
  ACTIVE: "Đang hoạt động",
  PENDING: "Chờ phản hồi",
  OPEN: "Đã tiếp nhận",
  UNDER_REVIEW: "Đang xem xét",
  NEED_MORE_INFO: "Cần bổ sung thông tin",
  RESOLVED: "Đã giải quyết",
  REJECTED: "Đã từ chối",
  ACCEPTED: "Đã chấp thuận",
  APPLIED: "Đã thực hiện",
  WITHDRAWN: "Đã rút yêu cầu",
  EXPIRED: "Đã hết hạn",
  CANCELLED: "Đã hủy",
  COMPLETED: "Đã hoàn thành",
  CONFIRMED: "Đã xác nhận",
  READY: "Sẵn sàng",
  SCHEDULED: "Đã lên lịch",
  ONGOING: "Đang diễn ra",
  AWAITING_CONFIRMATION: "Chờ xác nhận hoàn thành",
  DISPUTED: "Đang tranh chấp",
  BLOCKED: "Chưa đủ điều kiện xử lý",
  NOT_LOCKED: "Chưa chốt thỏa thuận",
  SETTLED: "Đã tất toán",
  RETRYING: "Đang thử xử lý lại",
  WAITING_SESSIONS: "Chờ hoàn thành các buổi học",
  WAITING_DISPUTE: "Chờ xử lý tranh chấp",
  WAITING_DISPUTE_WINDOW: "Chờ hết thời hạn khiếu nại",
  WAITING_TERMINATION: "Chờ hoàn tất dừng lộ trình",
  STOPPED: "Đã dừng học",
  USER: "Người dùng",
  STAFF: "Nhân viên",
  ADMIN: "Quản trị viên",
  SESSION: "Buổi học",
  LEARNING_PATH: "Lộ trình học",
  REPORT_CASE: "Hồ sơ báo cáo",
  REVIEW: "Đánh giá",
  RECOVERY_MISSION: "Nhiệm vụ phục hồi uy tín",
  REPUTATION_REVERSAL: "Hoàn tác thay đổi uy tín",
  REVIEW_RATING: "Đánh giá từ đối tác",
  SESSION_NO_SHOW: "Vắng buổi học",
  SESSION_COMPLETED: "Hoàn thành buổi học",
  COMPLETION: "Hoàn thành buổi học",
  PATH_COMPLETED: "Hoàn thành lộ trình",
  REPORT_RESOLUTION: "Quyết định xử lý báo cáo",
  ADJUDICATED_VIOLATION: "Vi phạm theo quyết định xử lý",
  LOW_REPUTATION: "Điểm uy tín thấp",
  RECOVERY_MISSION_REWARD: "Thưởng nhiệm vụ phục hồi uy tín",
  PENALTY_REVERSED: "Hoàn lại điểm bị trừ do xử lý sai",
  REPUTATION_EVENT_REVERSED: "Hoàn tác thay đổi điểm uy tín",
  POLICY_AWARENESS: "Tìm hiểu chính sách",
  GOOD_BEHAVIOR_STREAK: "Duy trì hành vi tốt",
  COMMITMENT_RECOVERY: "Khôi phục cam kết học tập",
  CREATE_NEW_ACTIVITY: "Hạn chế tạo hoạt động mới",
  REQUIRE_STAFF_REVIEW: "Cần nhân viên xem xét",
  REQUIRE_ADMIN_REVIEW: "Cần quản trị viên xem xét",
  ALL: "Mọi hoạt động",
  PATH_TERMINATION: "Dừng lộ trình",
  SESSION_CANCELLATION: "Hủy buổi học",
  SESSION_CREDIT_SNAPSHOT_MISSING:
    "Thiếu dữ liệu Credit từng buổi của lộ trình cũ. Cần quản trị viên kiểm tra và khôi phục dữ liệu trước khi tất toán.",
  TERMINATION_SESSION_RULING_REQUIRED:
    "Cần chốt kết quả các buổi học còn vướng trước khi tất toán dừng lộ trình.",
  TERMINATION_BLOCKED_BY_DISPUTE:
    "Cần giải quyết tranh chấp trước khi tất toán dừng lộ trình.",
  TERMINATION_POLICY_NOT_APPROVED:
    "Chính sách tất toán khi dừng lộ trình chưa được duyệt.",
  TERMINATION_USE_FINAL_SETTLEMENT:
    "Lộ trình đã học xong. Hãy dùng chức năng tất toán hoàn thành.",
  TERMINATION_ALREADY_APPROVED: "Lộ trình đã được chấp thuận dừng.",
  TERMINATION_ALLOCATION_MISMATCH:
    "Dữ liệu Credit tạm giữ chưa khớp. Cần quản trị viên kiểm tra.",
  SETTLEMENT_BLOCKED_BY_TERMINATION:
    "Đang xử lý dừng lộ trình nên chưa thể tất toán hoàn thành.",
  SETTLEMENT_BLOCKED_BY_DISPUTE:
    "Cần giải quyết tranh chấp trước khi tất toán.",
  PATH_SESSIONS_INCOMPLETE: "Cần hoàn thành các buổi học trước khi tất toán.",
  REVIEW_NOT_OPEN:
    "Chỉ được đánh giá sau khi lộ trình hoàn thành và đã tất toán.",
  REVIEW_ALREADY_SUBMITTED: "Bạn đã gửi đánh giá cho lộ trình này.",
  NO_SHOW_RULING_REQUIRED:
    "Cần chọn cách xử lý điểm danh trước khi đóng tranh chấp.",
  NO_SHOW_RULING_NOT_APPLICABLE:
    "Buổi học hiện không cho phép áp dụng quyết định điểm danh này.",
  MAKEUP_USER_REQUIRED: "Cần chọn người sử dụng lượt học bù.",
  MAKEUP_WINDOW_CLOSED: "Đã hết hạn chốt lịch học bù.",
  RESOLUTION_NOTE_REQUIRED: "Vui lòng nhập lý do xử lý tranh chấp.",
  SESSION_CANNOT_BE_RESCHEDULED:
    "Trạng thái hiện tại của buổi học hoặc lộ trình chưa cho phép đổi lịch.",
  SESSION_CANNOT_BE_CANCELLED:
    "Buổi học đã bắt đầu hoặc không còn đủ điều kiện hủy.",
  RECOVERY_MISSION_INCOMPLETE:
    "Bạn chưa hoàn thành điều kiện của nhiệm vụ phục hồi uy tín.",
  RECOVERY_MISSION_NOT_ELIGIBLE:
    "Tài khoản hiện chưa đủ điều kiện nhận nhiệm vụ này.",
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
