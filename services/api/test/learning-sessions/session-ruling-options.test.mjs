import assert from "node:assert/strict";
import { test } from "node:test";
import { projectSessionRulingOptions } from "../../dist/modules/learning-sessions/application/services/session-ruling-options.js";

const T = "11111111-1111-4111-8111-111111111111";
const L = "22222222-2222-4222-8222-222222222222";
const free = [
  { userId: T, reason: null, remaining: 1 },
  { userId: L, reason: null, remaining: 1 },
];
const sessionLimit = free.map((q) => ({
  ...q,
  reason: "SESSION_MAKEUP_LIMIT_REACHED",
}));
const verdicts = {
  TEACHER_ABSENT: ["ABSENT", "PRESENT"],
  LEARNER_ABSENT: ["PRESENT", "ABSENT"],
  BOTH_ABSENT: ["ABSENT", "ABSENT"],
  UNVERIFIABLE: ["UNVERIFIABLE", "UNVERIFIABLE"],
};
const outcome = (attendanceCase, evidence = {}) => ({
  attendanceCase,
  teacherVerdict: verdicts[attendanceCase][0],
  learnerVerdict: verdicts[attendanceCase][1],
  evidence,
});
const project = (overrides) =>
  projectSessionRulingOptions({
    session: { status: "NO_SHOW", teacherId: T, learnerId: L },
    outcome: outcome("TEACHER_ABSENT"),
    obligationsEnded: false,
    quotas: free,
    cancellationApplied: false,
    ...overrides,
  });
const rulings = (options) =>
  Object.fromEntries(
    options.noShowRulings.map((o) => [o.value, o.blockedReason]),
  );

test("teacher absent with quota left allows every no-show ruling", () => {
  const options = project({});
  assert.deepEqual(rulings(options), {
    UPHOLD: null,
    EXCUSE: null,
    COMPLETE: null,
  });
  assert.deepEqual(options.eligibleMakeupUserIds, [T, L]);
  assert.equal(options.makeupAlreadyGranted, false);
});

test("UPHOLD and EXCUSE report the quota reason when a second makeup would be needed", () => {
  for (const attendanceCase of ["TEACHER_ABSENT", "BOTH_ABSENT"]) {
    const options = project({
      outcome: outcome(attendanceCase),
      quotas: sessionLimit,
    });
    assert.deepEqual(rulings(options), {
      UPHOLD: "SESSION_MAKEUP_LIMIT_REACHED",
      EXCUSE: "SESSION_MAKEUP_LIMIT_REACHED",
      COMPLETE: null,
    });
    assert.deepEqual(options.eligibleMakeupUserIds, []);
  }
});

test("only the absent party's quota blocks the ruling", () => {
  const options = project({
    quotas: [
      { userId: T, reason: "USER_MAKEUP_LIMIT_REACHED", remaining: 0 },
      { userId: L, reason: null, remaining: 1 },
    ],
  });
  assert.equal(rulings(options).UPHOLD, "USER_MAKEUP_LIMIT_REACHED");
  assert.deepEqual(options.eligibleMakeupUserIds, [L]);
});

test("learner absence upholds without a makeup reservation", () => {
  const options = project({
    outcome: outcome("LEARNER_ABSENT"),
    quotas: sessionLimit,
  });
  assert.equal(rulings(options).UPHOLD, null);
  assert.equal(rulings(options).EXCUSE, "SESSION_MAKEUP_LIMIT_REACHED");
});

test("an already granted makeup is extended instead of reserved again", () => {
  const options = project({
    outcome: outcome("TEACHER_ABSENT", { makeupGranted: true }),
    quotas: sessionLimit,
  });
  assert.equal(options.makeupAlreadyGranted, true);
  assert.deepEqual(rulings(options), {
    UPHOLD: null,
    EXCUSE: null,
    COMPLETE: null,
  });
});

test("approved termination ends obligations without a makeup", () => {
  const options = project({ obligationsEnded: true, quotas: sessionLimit });
  assert.equal(options.obligationsEnded, true);
  assert.equal(rulings(options).UPHOLD, null);
  assert.equal(rulings(options).EXCUSE, null);
});

test("UPHOLD needs an absent case on a NO_SHOW Session", () => {
  assert.equal(
    rulings(project({ outcome: outcome("UNVERIFIABLE") })).UPHOLD,
    "NO_SHOW_RULING_NOT_APPLICABLE",
  );
  const disputed = project({
    session: { status: "DISPUTED", teacherId: T, learnerId: L },
  });
  assert.equal(rulings(disputed).UPHOLD, "NO_SHOW_RULING_NOT_APPLICABLE");
  assert.equal(rulings(disputed).EXCUSE, null);
});

test("EXCUSE without an absent party depends on an eligible participant", () => {
  const unverifiable = outcome("UNVERIFIABLE");
  assert.equal(rulings(project({ outcome: unverifiable })).EXCUSE, null);
  assert.equal(
    rulings(project({ outcome: unverifiable, quotas: sessionLimit })).EXCUSE,
    "SESSION_MAKEUP_LIMIT_REACHED",
  );
});

test("no attendance outcome or a decided Session blocks no-show rulings", () => {
  const blocked = {
    UPHOLD: "NO_SHOW_RULING_NOT_APPLICABLE",
    EXCUSE: "NO_SHOW_RULING_NOT_APPLICABLE",
    COMPLETE: "NO_SHOW_RULING_NOT_APPLICABLE",
  };
  assert.deepEqual(rulings(project({ outcome: null })), blocked);
  assert.deepEqual(
    rulings(
      project({ session: { status: "COMPLETED", teacherId: T, learnerId: L } }),
    ),
    blocked,
  );
});

test("cancellation rulings need an applied cancellation on a held Session", () => {
  const held = { status: "DISPUTED", teacherId: T, learnerId: L };
  const allowed = project({
    session: held,
    outcome: null,
    cancellationApplied: true,
  });
  assert.deepEqual(
    allowed.cancellationMakeupRulings.map((o) => [o.value, o.allowed]),
    [
      ["EXTEND", true],
      ["COMPLETE", true],
    ],
  );
  for (const input of [
    { session: held, cancellationApplied: false },
    { cancellationApplied: true },
  ])
    assert.ok(
      project({ outcome: null, ...input }).cancellationMakeupRulings.every(
        (o) => o.blockedReason === "CANCELLATION_MAKEUP_RULING_NOT_APPLICABLE",
      ),
    );
});
