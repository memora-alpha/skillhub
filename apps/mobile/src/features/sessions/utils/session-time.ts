import type { LearningSession, SessionRange } from "../types";

export const deviceTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
function parts(value: number, timeZone: string) {
  const values = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const number = (type: string) =>
    Number(values.find((v) => v.type === type)?.value);
  return Date.UTC(
    number("year"),
    number("month") - 1,
    number("day"),
    number("hour"),
    number("minute"),
    number("second"),
  );
}
function zonedMidnight(local: number, timeZone: string) {
  let instant = local;
  for (let i = 0; i < 4; i++) {
    const difference = local - parts(instant, timeZone);
    if (difference === 0) return instant;
    instant += difference;
  }
  throw new Error("Local calendar boundary is unavailable in this timezone.");
}
export function sessionRange(
  year: number,
  month: number,
  day: number | null = null,
  timeZone = deviceTimezone(),
): SessionRange {
  const start = Date.UTC(year, month, day ?? 1);
  const next =
    day === null
      ? Date.UTC(year, month + 1, 1)
      : Date.UTC(year, month, day + 1);
  return {
    from: new Date(zonedMidnight(start, timeZone)).toISOString(),
    to: new Date(zonedMidnight(next, timeZone) - 1).toISOString(),
  };
}
export function sessionDay(timestamp: string, timeZone = deviceTimezone()) {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric" }).format(
      new Date(timestamp),
    ),
  );
}
export function formatSessionTime(
  timestamp: string,
  timeZone = deviceTimezone(),
) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
export function sessionDuration(s: Pick<LearningSession, "startAt" | "endAt">) {
  return (Date.parse(s.endAt) - Date.parse(s.startAt)) / 60_000;
}
export function sessionGroup(
  s: Pick<LearningSession, "endAt"> & { status: string },
  now = Date.now(),
) {
  return s.status === "COMPLETED" ||
    s.status === "CANCELLED" ||
    Date.parse(s.endAt) <= now
    ? "history"
    : "upcoming";
}
export const listIsLimited = (items: readonly unknown[]) => items.length >= 100;
