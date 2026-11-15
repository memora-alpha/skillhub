import { BadRequestException } from "@nestjs/common";

const DAY_MS = 86_400_000;

export type AdminReportingWindow = {
  from: Date;
  to: Date;
  timezone: string;
};

export type AdminDayBucket = {
  localDate: string;
  fromUtc: Date;
  toUtc: Date;
  partial: boolean;
};

export function adminReportingWindow(input: {
  from: string;
  to: string;
  timezone?: string;
}): AdminReportingWindow {
  const from = new Date(input.from);
  const to = new Date(input.to);
  const timezone = input.timezone?.trim() || "Asia/Ho_Chi_Minh";
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    to <= from ||
    to.getTime() - from.getTime() > 366 * DAY_MS ||
    !validIanaTimezone(timezone)
  )
    throw new BadRequestException("INVALID_ADMIN_REPORTING_WINDOW");
  return { from, to, timezone };
}

export function adminDayBuckets(
  window: AdminReportingWindow,
): AdminDayBucket[] {
  const first = localDate(window.from, window.timezone);
  const last = localDate(new Date(window.to.getTime() - 1), window.timezone);
  const buckets: AdminDayBucket[] = [];
  for (let date = first; date <= last; date = addLocalDay(date)) {
    const fromUtc = localMidnightUtc(date, window.timezone);
    const toUtc = localMidnightUtc(addLocalDay(date), window.timezone);
    buckets.push({
      localDate: date,
      fromUtc,
      toUtc,
      partial: fromUtc < window.from || toUtc > window.to,
    });
  }
  return buckets;
}

export function validIanaTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

function localDate(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addLocalDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + 1))
    .toISOString()
    .slice(0, 10);
}

function localMidnightUtc(value: string, timezone: string) {
  const [year, month, day] = value.split("-").map(Number);
  const desired = Date.UTC(year!, month! - 1, day!);
  let guess = desired;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const number = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((item) => item.type === type)?.value);
    const represented = Date.UTC(
      number("year"),
      number("month") - 1,
      number("day"),
      number("hour"),
      number("minute"),
      number("second"),
    );
    const next = guess + desired - represented;
    if (next === guess) break;
    guess = next;
  }
  return new Date(guess);
}
