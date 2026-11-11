import type { LearningSession } from "../types";

export function noShowGuidance(
  session: Pick<LearningSession, "status" | "attendance" | "deadlines">,
  now = Date.now(),
) {
  if (
    session.status !== "NO_SHOW" ||
    session.attendance?.case !== "BOTH_ABSENT"
  )
    return;
  if (
    session.attendance.outcomeStatus === "DISPUTED" ||
    session.attendance.resolution === "STAFF_REVIEW"
  )
    return "Kết quả vắng học đang được xem xét.";
  const deadline = session.deadlines?.excuseOrReportBy;
  if (deadline && Date.parse(deadline) <= now)
    return "Đang chốt kết quả vắng học. Kéo xuống để cập nhật.";
  return deadline
    ? "Hệ thống xét học bù sau hạn phản hồi."
    : "Hệ thống đang xử lý kết quả vắng học.";
}

export function attendanceSideText(
  side: NonNullable<LearningSession["attendance"]>["teacher"],
) {
  if (!side?.verdict) return "Đang chờ số liệu điểm danh";
  if (side.verdict === "UNVERIFIABLE")
    return "Chưa đủ dữ liệu để xác minh thời lượng";
  const seconds = BigInt(side.seconds);
  return `${side.verdict === "PRESENT" ? "Có mặt" : "Vắng mặt"} · ${seconds / 60n} phút ${seconds % 60n} giây${side.late ? " · Vào muộn" : ""}`;
}
