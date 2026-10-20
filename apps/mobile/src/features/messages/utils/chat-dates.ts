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
  const prefix =
    chatDayKey(date) === chatDayKey(now)
      ? "Hôm nay · "
      : chatDayKey(date) === chatDayKey(yesterday)
        ? "Hôm qua · "
        : "";
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
  return chatDayKey(value) === chatDayKey(now)
    ? chatTime(value)
    : new Date(value).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        ...(new Date(value).getFullYear() !== now.getFullYear()
          ? { year: "numeric" as const }
          : {}),
      });
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
