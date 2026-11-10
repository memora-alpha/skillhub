const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const timeReasons = new Set([
  "START_NOT_IN_FUTURE",
  "END_NOT_AFTER_START",
  "DURATION_TOO_SHORT",
  "DURATION_TOO_LONG",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function safeInvalidItem(value: unknown) {
  if (!isRecord(value)) return undefined;
  const ids = [
    value.scheduleId,
    value.planId,
    value.teacherId,
    value.learnerId,
  ];
  if (
    !ids.every((id) => typeof id === "string" && uuidPattern.test(id)) ||
    value.teacherId === value.learnerId ||
    !positiveInteger(value.scheduleVersion) ||
    !positiveInteger(value.planVersion) ||
    !positiveInteger(value.sessionNo) ||
    !isTimestamp(value.startAt) ||
    !isTimestamp(value.endAt) ||
    !Array.isArray(value.reasons) ||
    value.reasons.length === 0 ||
    value.reasons.length > timeReasons.size ||
    !value.reasons.every(
      (reason) => typeof reason === "string" && timeReasons.has(reason),
    ) ||
    new Set(value.reasons).size !== value.reasons.length
  ) {
    return undefined;
  }
  // Invalid end/start order is deliberately allowed in this error response.
  return {
    scheduleId: value.scheduleId as string,
    scheduleVersion: value.scheduleVersion,
    planId: value.planId as string,
    planVersion: value.planVersion,
    teacherId: value.teacherId as string,
    learnerId: value.learnerId as string,
    sessionNo: value.sessionNo,
    startAt: value.startAt,
    endAt: value.endAt,
    reasons: value.reasons as string[],
  };
}

/** Explicit allowlist; arbitrary exception properties never reach clients. */
export function invalidScheduleDetails(
  status: number,
  text: string,
  detail: unknown,
) {
  if (
    status !== 409 ||
    text !== "INVALID_SCHEDULE_ITEMS" ||
    !isRecord(detail)
  ) {
    return undefined;
  }
  const { invalidItems: raw, evaluatedAt, durationMinutes } = detail;
  if (
    !Array.isArray(raw) ||
    raw.length === 0 ||
    raw.length > 200 ||
    !isTimestamp(evaluatedAt) ||
    !isRecord(durationMinutes) ||
    !positiveInteger(durationMinutes.min) ||
    !positiveInteger(durationMinutes.max) ||
    durationMinutes.max < durationMinutes.min
  ) {
    return undefined;
  }
  const invalidItems = raw.map(safeInvalidItem);
  if (invalidItems.some((item) => item === undefined)) return undefined;
  return {
    invalidItems,
    evaluatedAt,
    durationMinutes: { min: durationMinutes.min, max: durationMinutes.max },
  };
}
