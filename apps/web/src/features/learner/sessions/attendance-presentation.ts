import type { LearningSession } from "../types";

export function sessionRefreshInterval(session: LearningSession | undefined) {
  return session &&
    ["CONFIRMED", "READY", "ONGOING", "AWAITING_CONFIRMATION"].includes(
      session.status,
    )
    ? 30_000
    : false;
}

export function attendanceSideText(
  side: NonNullable<LearningSession["attendance"]>["teacher"],
) {
  if (!side || !side.verdict) return "Đang chờ số liệu điểm danh";
  if (side.verdict === "UNVERIFIABLE")
    return "Chưa đủ dữ liệu để xác minh thời lượng";
  let label = "Chưa có kết luận";
  if (side.verdict === "PRESENT") label = "Có mặt";
  else if (side.verdict === "ABSENT") label = "Vắng mặt";
  if (!/^\d+$/.test(side.seconds)) return label;
  const seconds = BigInt(side.seconds);
  return `${label} · ${seconds / 60n} phút ${seconds % 60n} giây${side.late ? " · Vào muộn" : ""}`;
}
