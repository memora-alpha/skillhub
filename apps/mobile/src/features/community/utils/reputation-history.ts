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
  const yesterdayLabel = format(yesterday);
  const groups = new Map<
    string,
    { date: string; label: string; items: Reputation["items"] }
  >();
  for (const item of items) {
    const date = format(new Date(item.createdAt));
    let label = date;
    if (date === today) label = "Hôm nay";
    else if (date === yesterdayLabel) label = "Hôm qua";
    const group = groups.get(date) ?? {
      date,
      label,
      items: [],
    };
    group.items.push(item);
    groups.set(date, group);
  }
  return [...groups.values()];
}
