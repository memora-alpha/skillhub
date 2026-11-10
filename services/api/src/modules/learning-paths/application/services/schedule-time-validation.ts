import { ConflictException } from "@nestjs/common";

type ScheduleTimeItem = {
  scheduleProposalId: string;
  scheduleVersion: number;
  planId: string;
  planVersion: number;
  teacherId: string;
  learnerId: string;
  sessionNo: number;
  startAt: Date;
  endAt: Date;
};

type TimeReason =
  | "START_NOT_IN_FUTURE"
  | "END_NOT_AFTER_START"
  | "DURATION_TOO_SHORT"
  | "DURATION_TOO_LONG";

function invalidTimeReasons(
  item: ScheduleTimeItem,
  now: Date,
  durationMinutes: { min: number; max: number },
): TimeReason[] {
  const reasons: TimeReason[] = [];
  if (item.startAt <= now) reasons.push("START_NOT_IN_FUTURE");
  if (item.endAt <= item.startAt) {
    reasons.push("END_NOT_AFTER_START");
    return reasons;
  }
  const duration = (item.endAt.getTime() - item.startAt.getTime()) / 60_000;
  if (duration < durationMinutes.min) reasons.push("DURATION_TOO_SHORT");
  if (duration > durationMinutes.max) reasons.push("DURATION_TOO_LONG");
  return reasons;
}

/** All invalid items from the confirmed current schedules, before any Hold/write. */
export function assertScheduleTimes(
  items: ScheduleTimeItem[],
  now: Date,
  durationMinutes: { min: number; max: number },
): void {
  const invalidItems = items.flatMap((item) => {
    const reasons = invalidTimeReasons(item, now, durationMinutes);
    if (!reasons.length) return [];
    return [
      {
        scheduleId: item.scheduleProposalId,
        scheduleVersion: item.scheduleVersion,
        planId: item.planId,
        planVersion: item.planVersion,
        teacherId: item.teacherId,
        learnerId: item.learnerId,
        sessionNo: item.sessionNo,
        startAt: item.startAt.toISOString(),
        endAt: item.endAt.toISOString(),
        reasons,
      },
    ];
  });
  if (invalidItems.length) {
    throw new ConflictException({
      message: "INVALID_SCHEDULE_ITEMS",
      invalidItems,
      evaluatedAt: now.toISOString(),
      durationMinutes,
    });
  }
}
