const ABSOLUTE_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/;

/** Parse an absolute RFC3339 timestamp without accepting Date's calendar normalization. */
export function parseAbsoluteTimestamp(input: unknown): Date {
  if (typeof input !== "string") {
    throw new TypeError("timestamp must be an absolute RFC3339 string");
  }
  const match = ABSOLUTE_TIMESTAMP.exec(input);
  if (!match) {
    throw new TypeError("timestamp must be an absolute RFC3339 string");
  }
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    fraction,
    zone,
    sign,
    offsetHourText,
    offsetMinuteText,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millis = Number((fraction ?? "").padEnd(3, "0"));
  const offsetHours = Number(offsetHourText ?? "0");
  const offsetMinutes = Number(offsetMinuteText ?? "0");
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHours > 23 ||
    offsetMinutes > 59
  ) {
    throw new TypeError("timestamp has invalid calendar or offset fields");
  }
  const local = new Date(0);
  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(hour, minute, second, millis);
  if (
    local.getUTCFullYear() !== year ||
    local.getUTCMonth() + 1 !== month ||
    local.getUTCDate() !== day ||
    local.getUTCHours() !== hour ||
    local.getUTCMinutes() !== minute ||
    local.getUTCSeconds() !== second
  ) {
    throw new TypeError("timestamp has an invalid calendar date");
  }
  const direction = zone === "Z" ? 0 : sign === "+" ? 1 : -1;
  const timestamp = new Date(
    local.getTime() - direction * (offsetHours * 60 + offsetMinutes) * 60_000,
  );
  if (Number.isNaN(timestamp.getTime())) {
    throw new TypeError("timestamp is outside the supported range");
  }
  return timestamp;
}

export function validateTimeZone(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) {
    throw new TypeError("timezone must be an IANA timezone name");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: input });
  } catch {
    throw new TypeError("timezone must be an IANA timezone name");
  }
  return input;
}

export function isAtLeastMinutesBefore(
  startAt: Date,
  now: Date,
  minutes: number,
): boolean {
  if (
    !Number.isSafeInteger(minutes) ||
    minutes < 0 ||
    !Number.isFinite(startAt.getTime()) ||
    !Number.isFinite(now.getTime())
  ) {
    throw new TypeError(
      "cutoff requires valid dates and nonnegative whole minutes",
    );
  }
  return startAt.getTime() - now.getTime() >= minutes * 60_000;
}
