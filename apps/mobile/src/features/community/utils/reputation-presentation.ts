import type { Reputation } from "../api/community-api";

export const reputationReasons: Record<string, string> = {
  PATH_COMPLETED: "Hoàn thành lộ trình",
  REVIEW_RATING: "Đánh giá từ người trao đổi",
  LOW_REPUTATION: "Điểm uy tín thấp",
  ADJUDICATED_VIOLATION: "Quyết định xử lý vi phạm",
  LATE_CANCELLATION: "Hủy lịch muộn",
  NO_SHOW: "Vắng mặt",
  LIGHT_VIOLATION: "Vi phạm nhẹ",
  MEDIUM_HARASSMENT: "Quấy rối",
  FRAUD: "Gian lận",
  RECOVERY_MISSION_REWARD: "Hoàn thành nhiệm vụ phục hồi",
  PENALTY_REVERSED: "Hoàn lại điểm đã trừ",
  RECOVERY_REWARD_REVOKED: "Thu hồi điểm phục hồi",
  QA_ADMIN_ADJUSTMENT: "Điều chỉnh bởi quản trị viên",
};
export const reputationLevels: Record<string, string> = {
  EXCELLENT: "Rất tốt",
  NORMAL: "Bình thường",
  WARNING: "Cảnh báo",
  RESTRICTED: "Hạn chế",
  LOW: "Thấp",
  SEVERE: "Rất thấp",
  CRITICAL: "Nghiêm trọng",
};
export const restrictionScopes: Record<string, string> = {
  ALL: "Hạn chế hoạt động tài khoản",
  "learning-request:create": "Hạn chế tạo yêu cầu học",
  CREATE_NEW_ACTIVITY: "Hạn chế tạo hoạt động mới",
  REQUIRE_STAFF_REVIEW: "Cần nhân viên xem xét",
  REQUIRE_ADMIN_REVIEW: "Cần quản trị viên xem xét",
};
export function reputationTone(level: string) {
  if (["RESTRICTED", "LOW", "SEVERE", "CRITICAL"].includes(level))
    return "error";
  if (level === "WARNING") return "warning";
  if (["NORMAL", "EXCELLENT"].includes(level)) return "forest";
  return "muted";
}
export function reviewDecisionText(decision: string | null) {
  if (decision === "APPROVED") return "Đã được xem xét và chấp thuận";
  if (decision === "FOLLOW_UP_REQUIRED") return "Cần tiếp tục theo dõi";
  return "Đang chờ xem xét";
}
export function matchingRestrictionReview(
  data: Reputation,
  scope: string,
  endsAt: string,
) {
  return data.restrictionReviews?.find(
    (review) => review.scope === scope && review.endsAt === endsAt,
  );
}
export function reputationDate(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
