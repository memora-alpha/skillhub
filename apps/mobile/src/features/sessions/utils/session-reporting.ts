import type { LearningSession } from "../types";

export function sessionReportingState(
  reporting: LearningSession["reporting"],
  age = 0,
) {
  const expired =
    !!reporting?.canReport &&
    !!reporting.reportBy &&
    reportRefreshDelay(reporting, age) === 0;
  const allowed =
    !!reporting?.canReport &&
    reporting.blockedReason === null &&
    !!reporting.reportBy &&
    !expired;
  let reason: string | null = null;
  if (!allowed) {
    const fallback = expired
      ? "DISPUTE_WINDOW_CLOSED"
      : "REPORT_POLICY_UNAVAILABLE";
    reason = reporting?.blockedReason ?? fallback;
  }
  let message = "Tạm chưa thể gửi báo cáo. Vui lòng thử lại.";
  switch (reason) {
    case null:
      message = "Còn hạn gửi báo cáo.";
      break;
    case "DISPUTE_WINDOW_CLOSED":
      message = "Đã hết hạn gửi báo cáo.";
      break;
    case "ACTIVE_SESSION_REPORT_EXISTS":
      message = "Bạn đã có báo cáo đang xử lý cho buổi học này.";
      break;
    case "SESSION_NOT_REPORTABLE":
      message = "Buổi học đã hủy, không thể gửi báo cáo.";
      break;
    case "SESSION_ACCESS_DENIED":
      message = "Bạn không có quyền báo cáo buổi học này.";
      break;
  }
  return { allowed, reason, message, reportBy: reporting?.reportBy ?? null };
}

// Use the server's deadline/evaluation interval, never a hard-coded dispute window.
export function reportRefreshDelay(
  reporting: LearningSession["reporting"],
  age = 0,
) {
  if (!reporting?.canReport || !reporting.reportBy) return null;
  return Math.max(
    0,
    Date.parse(reporting.reportBy) -
      Date.parse(reporting.evaluatedAt) -
      Math.max(0, age),
  );
}
