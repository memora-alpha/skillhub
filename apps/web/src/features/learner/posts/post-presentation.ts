import type { Post } from "../types";

export const postLevels: Record<string, string> = {
  NONE: "Chưa có nền tảng",
  BEGINNER: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
  EXPERT: "Chuyên gia",
};
const states: Record<string, string> = {
  DRAFT: "Bản nháp",
  OPEN: "Đang mở",
  PENDING_MODERATION: "Chờ duyệt",
  REJECTED: "Chưa được duyệt",
  NEGOTIATING: "Đang trao đổi",
  MATCHED: "Đã chốt lịch",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
};
export function postDisplayState(post: Post) {
  return post.effectiveStatus ?? post.status;
}
export function postStatusLabel(post: Post) {
  const state = postDisplayState(post);
  return states[state] ?? state;
}
export function postCredit(value: string | null) {
  return value && Number.isFinite(Number(value))
    ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(
        Number(value),
      ) + " CR"
    : "Chưa đặt Credit";
}
export function postAge(value: string, now: number) {
  const created = Date.parse(value);
  if (!Number.isFinite(created)) return "";
  const minutes = Math.max(0, Math.floor((now - created) / 60000));
  if (minutes < 1) return "Vừa tạo";
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} ngày trước`;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
  }).format(created);
}
