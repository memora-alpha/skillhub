import type { LearningSession } from "../types";

export function sessionSchedule(
  session: Pick<LearningSession, "startAt" | "endAt">,
  timeZone: string,
) {
  const start = new Date(session.startAt),
    end = new Date(session.endAt);
  const time = new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const date = new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    dateStyle: "full",
  });
  const startDate = date.format(start),
    endDate = date.format(end);
  return {
    day: new Intl.DateTimeFormat("vi-VN", { timeZone, day: "2-digit" }).format(
      start,
    ),
    month: new Intl.DateTimeFormat("en-GB", {
      timeZone,
      month: "2-digit",
    }).format(start),
    time: `${time.format(start)} — ${time.format(end)}`,
    date: startDate === endDate ? startDate : `${startDate} — ${endDate}`,
  };
}
