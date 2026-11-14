import { BadRequestException } from "@nestjs/common";
import { parseAbsoluteTimestamp } from "../../shared/time/timestamp.policy";

export const dashboardTimezones = ["UTC", "Asia/Ho_Chi_Minh"] as const;
export const dashboardGranularities = ["day", "month"] as const;

export type DashboardTimezone = (typeof dashboardTimezones)[number];
export type DashboardGranularity = (typeof dashboardGranularities)[number];

export type DashboardPeriod = {
  from: Date;
  to: Date;
  timezone: DashboardTimezone;
  granularity: DashboardGranularity;
};

const maximumDays = 366;
const dayMilliseconds = 86_400_000;
const calendarFormatters = new Map(
  dashboardTimezones.map((timezone) => [
    timezone,
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      calendar: "iso8601",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
  ]),
);

export function dashboardPeriod(input: {
  from: string;
  to: string;
  timezone?: string;
  granularity?: string;
}): DashboardPeriod {
  const timezone = input.timezone ?? "Asia/Ho_Chi_Minh";
  const granularity = input.granularity ?? "day";
  if (timezone !== "UTC" && timezone !== "Asia/Ho_Chi_Minh")
    throw new BadRequestException("INVALID_DASHBOARD_TIMEZONE");
  if (granularity !== "day" && granularity !== "month")
    throw new BadRequestException("INVALID_DASHBOARD_GRANULARITY");

  let from: Date;
  let to: Date;
  try {
    from = parseAbsoluteTimestamp(input.from);
    to = parseAbsoluteTimestamp(input.to);
  } catch {
    throw new BadRequestException("INVALID_DASHBOARD_TIMESTAMP");
  }
  const duration = to.getTime() - from.getTime();
  if (
    from.getUTCFullYear() < 1 ||
    duration <= 0 ||
    duration > maximumDays * dayMilliseconds
  )
    throw new BadRequestException("INVALID_DASHBOARD_RANGE");
  return { from, to, timezone, granularity };
}

function localDay(time: Date, timezone: DashboardTimezone) {
  const parts = calendarFormatters.get(timezone)!.formatToParts(time);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const day = new Date(0);
  day.setUTCFullYear(read("year"), read("month") - 1, read("day"));
  return day;
}

function localMidnight(day: Date, timezone: DashboardTimezone): number {
  // Find the first instant of this calendar date with the runtime's timezone data.
  let low = day.getTime() - dayMilliseconds;
  let high = day.getTime() + dayMilliseconds;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (localDay(new Date(middle), timezone) < day) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function dashboardBuckets(period: DashboardPeriod) {
  const day = localDay(period.from, period.timezone);
  const month = period.granularity === "month";
  if (month) day.setUTCDate(1);
  let start = period.from.getTime();
  const end = period.to.getTime();
  const buckets: { key: string; bucketStart: string; bucketEnd: string }[] = [];
  while (start < end) {
    const key = day.toISOString().split("T")[0]!;
    if (month) day.setUTCMonth(day.getUTCMonth() + 1);
    else day.setUTCDate(day.getUTCDate() + 1);
    const boundary = Math.min(end, localMidnight(day, period.timezone));
    buckets.push({
      key: month ? key.slice(0, -3) : key,
      bucketStart: new Date(start).toISOString(),
      bucketEnd: new Date(boundary).toISOString(),
    });
    start = boundary;
  }
  return buckets;
}
