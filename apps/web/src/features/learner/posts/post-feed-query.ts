export const ownPostStatuses = [
  ["DRAFT", "Bản nháp"],
  ["PENDING_MODERATION", "Chờ duyệt"],
  ["OPEN", "Đang tìm người hướng dẫn"],
  ["REJECTED", "Đã từ chối"],
  ["NEGOTIATING", "Đang trao đổi"],
  ["MATCHED", "Đã chốt lịch"],
  ["CLOSED", "Đã hoàn tất"],
  ["CANCELLED", "Đã hủy"],
  ["EXPIRED", "Đã hết hạn"],
] as const;

export function postFeedQuery({
  mine,
  keyword,
  skillId,
  tagIds,
  status,
}: {
  mine: boolean;
  keyword: string;
  skillId: string;
  tagIds: readonly string[];
  status: string;
}) {
  const query = new URLSearchParams({ limit: "20" });
  if (keyword.trim()) query.set("keyword", keyword.trim());
  if (skillId) query.set("skillId", skillId);
  for (const id of [...new Set(tagIds)].sort((a, b) => a.localeCompare(b)))
    query.append("tagIds", id);
  if (mine && ownPostStatuses.some(([value]) => value === status))
    query.set("status", status);
  return `learning-requests${mine ? "/mine" : ""}?${query}`;
}
