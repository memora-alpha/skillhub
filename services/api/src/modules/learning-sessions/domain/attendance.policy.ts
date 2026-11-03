import type { ConfigurationValue } from "../../system-configuration/domain/configuration.catalog";

export type AttendancePolicy = ConfigurationValue<"session.attendancePolicy">;
export type Verdict = "PRESENT" | "ABSENT" | "UNVERIFIABLE";
export type AttendanceCaseValue =
  | "BOTH_PRESENT"
  | "TEACHER_ABSENT"
  | "LEARNER_ABSENT"
  | "BOTH_ABSENT"
  | "UNVERIFIABLE";
export type IntervalInput = {
  joinedAt: Date;
  leftAt: Date | null;
  lastSeenAt: Date;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const hoursAfter = (at: Date, hours: number) =>
  new Date(+at + hours * HOUR);
export const daysAfter = (at: Date, days: number) =>
  new Date(+at + days * 24 * HOUR);

/** Union of connection intervals clipped to the occurrence, in whole seconds. */
export function attendedSeconds(
  intervals: readonly IntervalInput[],
  startAt: Date,
  endAt: Date,
): number {
  const spans = intervals
    .map(({ joinedAt, leftAt, lastSeenAt }) => [
      Math.max(+joinedAt, +startAt),
      Math.min(+(leftAt ?? lastSeenAt), +endAt),
    ])
    .filter(([from, to]) => to! > from!)
    .sort((left, right) => left[0]! - right[0]!);
  let total = 0;
  let cursor = Number.NEGATIVE_INFINITY;
  for (const [from, to] of spans) {
    const begin = Math.max(from!, cursor);
    if (to! > begin) total += to! - begin;
    cursor = Math.max(cursor, to!);
  }
  return Math.floor(total / 1000);
}

export function participantVerdict(input: {
  tokenIssued: boolean;
  seconds: number;
  firstJoinedAt: Date | null;
  startAt: Date;
  endAt: Date;
  policy: AttendancePolicy;
  liveKitAvailable: boolean;
  observationHealthy: boolean;
}): { verdict: Verdict; late: boolean } {
  const late =
    input.firstJoinedAt !== null &&
    +input.firstJoinedAt >
      +input.startAt + input.policy.lateGraceMinutes * MINUTE;
  // Without LiveKit or a join window nobody could join, so nobody is at fault.
  if (!input.liveKitAvailable) return { verdict: "UNVERIFIABLE", late };
  // The server issues every token, so no token proves the participant never joined.
  if (!input.tokenIssued) return { verdict: "ABSENT", late: false };
  const required =
    (((+input.endAt - +input.startAt) / 1000) *
      input.policy.minAttendancePercent) /
    100;
  if (input.seconds >= required) return { verdict: "PRESENT", late };
  // Missing seconds may be lost provider data; only a healthy pipeline proves absence.
  return {
    verdict: input.observationHealthy ? "ABSENT" : "UNVERIFIABLE",
    late,
  };
}

export function attendanceCase(
  teacher: Verdict,
  learner: Verdict,
): AttendanceCaseValue {
  if (teacher === "ABSENT" && learner === "ABSENT") return "BOTH_ABSENT";
  if (teacher === "ABSENT") return "TEACHER_ABSENT";
  if (learner === "ABSENT") return "LEARNER_ABSENT";
  if (teacher === "PRESENT" && learner === "PRESENT") return "BOTH_PRESENT";
  return "UNVERIFIABLE";
}

export const isAbsentCase = (value: AttendanceCaseValue) =>
  value === "TEACHER_ABSENT" ||
  value === "LEARNER_ABSENT" ||
  value === "BOTH_ABSENT";

export function absentUserIds(
  session: { teacherId: string; learnerId: string },
  outcome: { teacherVerdict: Verdict; learnerVerdict: Verdict },
): string[] {
  return [
    ...(outcome.teacherVerdict === "ABSENT" ? [session.teacherId] : []),
    ...(outcome.learnerVerdict === "ABSENT" ? [session.learnerId] : []),
  ];
}

/** LiveKit answered during the occurrence and never failed inside it. */
export function observationHealthy(session: {
  lastObservedAt: Date | null;
  observationFailedAt: Date | null;
  startAt: Date;
  endAt: Date;
}): boolean {
  const failed = session.observationFailedAt;
  const failedInside =
    failed !== null && +failed >= +session.startAt && +failed <= +session.endAt;
  return (
    !failedInside &&
    session.lastObservedAt !== null &&
    +session.lastObservedAt >= +session.startAt
  );
}

export function determinationAt(
  endAt: Date,
  joinLateMinutes: number,
  policy: AttendancePolicy,
): Date {
  return new Date(
    +endAt + (joinLateMinutes + policy.dataSettleMinutes) * MINUTE,
  );
}
