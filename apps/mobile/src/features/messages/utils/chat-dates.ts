import type { ChatTimelineItem } from "./chat-timeline";

export function chatDayKey(value: string | Date) {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
export function chatTime(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
export function chatDayLabel(value: string, now = new Date()) {
  const date = new Date(value);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  let prefix = "";
  if (chatDayKey(date) === chatDayKey(now)) prefix = "Hôm nay · ";
  else if (chatDayKey(date) === chatDayKey(yesterday)) prefix = "Hôm qua · ";
  return (
    prefix +
    date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  );
}
export function inboxTime(value: string, now = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  if (chatDayKey(date) === chatDayKey(now)) return chatTime(value);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  if (date >= weekStart && date < today)
    return ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"][
      date.getDay()
    ]!;
  const year =
    date.getFullYear() !== now.getFullYear() ? `, ${date.getFullYear()}` : "";
  return `${date.getDate()} thg ${date.getMonth() + 1}${year}`;
}
export type DatedChatItem =
  | (ChatTimelineItem & { showTime: boolean })
  | { kind: "day"; id: string; date: string };
export function groupChatDays(items: ChatTimelineItem[]): DatedChatItem[] {
  const days = new Map<string, { date: string; items: ChatTimelineItem[] }>();
  for (const item of items) {
    const date =
      item.kind === "message" ? item.message.sentAt : item.entry.createdAt;
    const key = chatDayKey(date);
    const group = days.get(key) ?? { date, items: [] };
    group.items.push(item);
    days.set(key, group);
  }
  return [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, group]): DatedChatItem[] => {
      let previousMinute: number | undefined;
      return [
        { kind: "day", id: `day:${key}`, date: group.date },
        ...group.items.map((item) => {
          if (
            item.kind === "message" &&
            item.message.messageType === "SYSTEM"
          ) {
            previousMinute = undefined;
            return { ...item, showTime: false };
          }
          const date =
            item.kind === "message"
              ? item.message.sentAt
              : item.entry.createdAt;
          const minute = Math.floor(Date.parse(date) / 60000);
          const showTime = minute !== previousMinute;
          previousMinute = minute;
          return { ...item, showTime };
        }),
      ];
    });
}
