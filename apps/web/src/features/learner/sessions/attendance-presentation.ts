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
  const label =
    side.verdict === "PRESENT"
      ? "Có mặt"
      : side.verdict === "ABSENT"
        ? "Vắng mặt"
        : "Chưa có kết luận";
  if (!/^\d+$/.test(side.seconds)) return label;
  const seconds = BigInt(side.seconds);
  return `${label} · ${seconds / 60n} phút ${seconds % 60n} giây${side.late ? " · Vào muộn" : ""}`;
}
