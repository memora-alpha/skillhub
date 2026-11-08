import type { Reputation } from "../api/community-api";

export function reputationHistoryGroups(
  items: Reputation["items"],
  now = new Date(),
) {
  const format = (date: Date) =>
    date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  const today = format(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const groups = new Map<
    string,
    { date: string; label: string; items: Reputation["items"] }
  >();
  for (const item of items) {
    const date = format(new Date(item.createdAt));
    const group = groups.get(date) ?? {
      date,
      label:
        date === today
          ? "Hôm nay"
          : date === format(yesterday)
            ? "Hôm qua"
            : date,
      items: [],
    };
    group.items.push(item);
    groups.set(date, group);
  }
  return [...groups.values()];
}
