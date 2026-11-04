export const reportStatuses = [
  ["OPEN", "Đã tiếp nhận"],
  ["UNDER_REVIEW", "Đang xem xét"],
  ["NEED_MORE_INFO", "Cần bổ sung thông tin"],
  ["RESOLVED", "Đã xử lý"],
  ["REJECTED", "Đã từ chối"],
] as const;
export function reportStatusLabel(status: string) {
  return reportStatuses.find(([code]) => code === status)?.[1] ?? status;
}
