import type { LearningSession } from "../types";

export function attendanceSideText(
  side: NonNullable<LearningSession["attendance"]>["teacher"],
) {
  if (!side || !side.verdict) return "Đang chờ số liệu điểm danh";
  if (side.verdict === "UNVERIFIABLE")
    return "Chưa đủ dữ liệu để xác minh thời lượng";
  const seconds = BigInt(side.seconds);
  return `${side.verdict === "PRESENT" ? "Có mặt" : "Vắng mặt"} · ${seconds / 60n} phút ${seconds % 60n} giây${side.late ? " · Vào muộn" : ""}`;
}
