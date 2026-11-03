import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attendedSeconds,
  participantVerdict,
  attendanceCase,
  absentUserIds,
  observationHealthy,
  determinationAt,
} from "../../dist/modules/learning-sessions/domain/attendance.policy.js";

const startAt = new Date("2026-11-02T10:00:00Z");
const endAt = new Date("2026-11-02T11:00:00Z");
const at = (minutes) => new Date(+startAt + minutes * 60000);
const span = (from, to) => ({
  joinedAt: at(from),
  leftAt: at(to),
  lastSeenAt: at(to),
});
const policy = {
  lateGraceMinutes: 10,
  minAttendancePercent: 80,
  dataSettleMinutes: 10,
  confirmWindowHours: 24,
  disputeWindowHours: 48,
  makeupWindowDays: 7,
};
const base = {
  tokenIssued: true,
  firstJoinedAt: at(0),
  startAt,
  endAt,
  policy,
  liveKitAvailable: true,
  observationHealthy: true,
};

test("seconds union overlapping devices, reconnects and clip to the schedule", () => {
  assert.equal(
    attendedSeconds([span(-5, 20), span(10, 30), span(40, 70)], startAt, endAt),
    50 * 60,
  );
  assert.equal(attendedSeconds([], startAt, endAt), 0);
  assert.equal(attendedSeconds([span(70, 80)], startAt, endAt), 0);
  // An open interval counts only until it was last seen.
  assert.equal(
    attendedSeconds(
      [{ joinedAt: at(0), leftAt: null, lastSeenAt: at(15) }],
      startAt,
      endAt,
    ),
    15 * 60,
  );
  // Out-of-order left before joined collapses to zero length.
  assert.equal(attendedSeconds([span(5, 5)], startAt, endAt), 0);
});

test("verdict thresholds: 80% present, late after 10 minutes", () => {
  assert.deepEqual(participantVerdict({ ...base, seconds: 48 * 60 }), {
    verdict: "PRESENT",
    late: false,
  });
  assert.deepEqual(participantVerdict({ ...base, seconds: 48 * 60 - 1 }), {
    verdict: "ABSENT",
    late: false,
  });
  assert.deepEqual(
    participantVerdict({ ...base, seconds: 49 * 60, firstJoinedAt: at(10) }),
    { verdict: "PRESENT", late: false },
  );
  assert.equal(
    participantVerdict({ ...base, seconds: 48 * 60, firstJoinedAt: at(11) })
      .late,
    true,
  );
});

test("missing data never becomes a penalised absence", () => {
  assert.equal(
    participantVerdict({ ...base, seconds: 0, tokenIssued: false }).verdict,
    "ABSENT",
  );
  assert.equal(
    participantVerdict({ ...base, seconds: 0, observationHealthy: false })
      .verdict,
    "UNVERIFIABLE",
  );
  assert.equal(
    participantVerdict({
      ...base,
      seconds: 0,
      liveKitAvailable: false,
      tokenIssued: false,
    }).verdict,
    "UNVERIFIABLE",
  );
  assert.equal(
    participantVerdict({ ...base, seconds: 48 * 60, observationHealthy: false })
      .verdict,
    "PRESENT",
  );
});

test("case matrix and absent users", () => {
  assert.equal(attendanceCase("PRESENT", "PRESENT"), "BOTH_PRESENT");
  assert.equal(attendanceCase("ABSENT", "PRESENT"), "TEACHER_ABSENT");
  assert.equal(attendanceCase("ABSENT", "UNVERIFIABLE"), "TEACHER_ABSENT");
  assert.equal(attendanceCase("PRESENT", "ABSENT"), "LEARNER_ABSENT");
  assert.equal(attendanceCase("ABSENT", "ABSENT"), "BOTH_ABSENT");
  assert.equal(attendanceCase("PRESENT", "UNVERIFIABLE"), "UNVERIFIABLE");
  assert.deepEqual(
    absentUserIds(
      { teacherId: "t", learnerId: "l" },
      { teacherVerdict: "ABSENT", learnerVerdict: "ABSENT" },
    ),
    ["t", "l"],
  );
});

test("observation health and determination time", () => {
  const row = {
    startAt,
    endAt,
    lastObservedAt: at(30),
    observationFailedAt: null,
  };
  assert.equal(observationHealthy(row), true);
  assert.equal(observationHealthy({ ...row, lastObservedAt: null }), false);
  assert.equal(
    observationHealthy({ ...row, observationFailedAt: at(20) }),
    false,
  );
  assert.equal(
    observationHealthy({ ...row, observationFailedAt: at(-60) }),
    true,
  );
  assert.equal(
    determinationAt(endAt, 10, policy).toISOString(),
    "2026-11-02T11:20:00.000Z",
  );
});
