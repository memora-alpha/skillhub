export type CaseMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
};

export function caseMessageTimeline(
  messages: readonly CaseMessage[],
  timeZone?: string,
) {
  const days = new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    dateStyle: "short",
  });
  const times = new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    timeStyle: "short",
    hourCycle: "h23",
  });
  const ordered = [
    ...new Map(messages.map((message) => [message.id, message])).values(),
  ].sort(
    (a, b) =>
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
  return ordered.map((message, index) => {
    const date = new Date(message.createdAt),
      day = days.format(date);
    return {
      message,
      day,
      time: times.format(date),
      startsDay:
        index === 0 ||
        days.format(new Date(ordered[index - 1]!.createdAt)) !== day,
    };
  });
}
