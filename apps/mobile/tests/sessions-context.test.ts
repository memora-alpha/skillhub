import assert from "node:assert/strict";
import test from "node:test";
import { sessionSchema } from "../src/features/sessions/types";
import {
  resolveSessionContext,
  pathSessionItems,
} from "../src/features/sessions/utils/session-context";
import { rescheduleSnapshot } from "../src/features/sessions/utils/reschedule-snapshot";
import {
  isRescheduleEligible,
  rescheduleAvailabilityMessage,
} from "../src/features/sessions/utils/reschedule-form";
import { readLearningPath } from "../src/features/learning-paths/api/learning-paths-read";
import { sessionPath } from "./fixtures/session-path";
import { fixtureId } from "./fixtures/learning-requests-data";
import { sessionRecord } from "./fixtures/sessions-client";

test("detail keeps version/outline/progress, while list projections need no invented fields", () => {
  const { session } = sessionPath();
  const progress = {
    agreement: { completed: 2, total: 5 },
    plan: { completed: 1, total: 3 },
  };
  const result = sessionSchema.parse({
    ...session,
    progress,
    roomMetadata: "private",
  });
  assert.equal(result.planVersion, session.planVersion);
  assert.equal(result.outlineSessionNo, 1);
  assert.deepEqual(result.progress, progress);
  assert.equal("roomMetadata" in result, false);
  assert.equal(sessionSchema.parse(sessionRecord()).progress, undefined);
  for (const bad of [
    {
      agreement: { completed: -1, total: 2 },
      plan: { completed: 0, total: 1 },
    },
    { agreement: { completed: 1, total: 2 }, plan: { completed: 2, total: 2 } },
    { agreement: { completed: 0, total: 2 }, plan: { completed: 0, total: 3 } },
    {
      agreement: { completed: 1.5, total: 2 },
      plan: { completed: 0, total: 1 },
    },
  ])
    assert.equal(
      sessionSchema.safeParse({ ...session, progress: bad }).success,
      false,
    );
});

test("Session context requires exact path/plan version/outline and actual identity in both directions", () => {
  for (const reverse of [false, true]) {
    const { session, path, plan } = sessionPath(reverse);
    assert.equal(resolveSessionContext(session, path)?.plan.id, plan.id);
    for (const patch of [
      { pathId: fixtureId(99) },
      { planId: path.plans[reverse ? 0 : 1]!.id },
      { planVersion: undefined },
      { planVersion: plan.version + 1 },
      { outlineSessionNo: 2 },
      { id: fixtureId(98) },
      { teacherId: session.learnerId, learnerId: session.teacherId },
    ])
      assert.equal(
        resolveSessionContext({ ...session, ...patch }, path),
        undefined,
      );
  }
});

test("Path list uses actual sessions across months and never substitutes pending proposal times", () => {
  const { path, plan, schedule, session } = sessionPath();
  const actual = plan.sessions[0]!;
  plan.totalSessions = 100;
  plan.sessions = Array.from({ length: 100 }, (_, i) => ({
    ...actual,
    id: fixtureId(100 + i),
    sessionNo: i + 1,
  }));
  path.plans[1]!.sessions = [
    {
      ...actual,
      id: fixtureId(250),
      sessionNo: 1,
      startAt: "2030-06-01T00:00:00Z",
      endAt: "2030-06-01T01:00:00Z",
    },
  ];
  schedule.items[0]!.startAt = "2031-01-01T00:00:00Z";
  const items = pathSessionItems(path);
  assert.equal(items.length, 101);
  assert.equal(items[0]!.startAt, session.startAt);
  assert.equal(items[100]!.startAt, "2030-06-01T00:00:00Z");
  assert.equal("teacherConfirmationStatus" in items[0]!, false);
});

test("Path reader rejects ambiguous Session identity/slot and invalid effective times", () => {
  for (const corrupt of [
    (f: ReturnType<typeof sessionPath>) =>
      f.plan.sessions.push({ ...f.plan.sessions[0]! }),
    (f: ReturnType<typeof sessionPath>) => {
      f.plan.sessions[0]!.sessionNo = 2;
    },
    (f: ReturnType<typeof sessionPath>) => {
      f.plan.sessions[0]!.endAt = f.session.startAt;
    },
    (f: ReturnType<typeof sessionPath>) => {
      f.path.plans[1]!.sessions = [{ ...f.plan.sessions[0]! }];
    },
  ]) {
    const f = sessionPath();
    corrupt(f);
    assert.throws(() =>
      readLearningPath(f.path, f.path.id, f.session.teacherId),
    );
  }
});

test("reschedule reload reads schedule version and A/B confirmations independently of teaching direction", () => {
  const { path, session, schedule } = sessionPath(true);
  schedule.version++;
  schedule.status = "PARTIALLY_CONFIRMED";
  schedule.participantAConfirmedAt = null;
  schedule.items[0] = {
    ...schedule.items[0]!,
    startAt: "2030-01-03T10:00:00Z",
    endAt: "2030-01-03T11:00:00Z",
  };
  const context = resolveSessionContext(session, path)!;
  const snapshot = rescheduleSnapshot(session, context, session.teacherId)!;
  assert.equal(snapshot.version, schedule.version);
  assert.equal(snapshot.appliedVersion, schedule.version - 1);
  assert.equal(snapshot.pending, true);
  assert.equal(snapshot.ownConfirmed, true); // Reverse teacher is participant B.
  assert.equal(snapshot.partnerConfirmed, false);
  assert.notEqual(snapshot.item.startAt, session.startAt);
  assert.equal(rescheduleSnapshot(session, context, fixtureId(99)), undefined);
  assert.equal(
    rescheduleSnapshot(
      { ...session, startAt: "2030-01-01T00:00:00Z" },
      context,
      session.teacherId,
    ),
    undefined,
  );
  schedule.appliedVersion = null;
  assert.equal(
    rescheduleSnapshot(session, context, session.teacherId),
    undefined,
  );
});

test("an unchanged Session does not inherit another slot's pending reschedule", () => {
  const { path, session, schedule } = sessionPath();
  schedule.version++;
  schedule.status = "NEEDS_REVISION";
  const context = resolveSessionContext(session, path)!;
  assert.equal(
    rescheduleSnapshot(session, context, session.teacherId)?.pending,
    false,
  );
  schedule.items[0]!.startAt = "2030-01-03T10:00:00Z";
  schedule.items[0]!.endAt = "2030-01-03T11:00:00Z";
  assert.equal(
    rescheduleSnapshot(session, context, session.teacherId)?.pending,
    true,
  );
  for (const status of ["CANCELLED", "EXPIRED"] as const) {
    schedule.status = status;
    assert.equal(
      rescheduleSnapshot(session, context, session.teacherId)?.pending,
      false,
    );
  }
});

test("applied schedule times must match the effective Session before showing confirmation state", () => {
  const { path, session, schedule } = sessionPath();
  const context = resolveSessionContext(session, path)!;
  assert.equal(
    rescheduleSnapshot(session, context, session.teacherId)?.pending,
    false,
  );
  schedule.items[0]!.endAt = "2030-01-02T13:00:00Z";
  assert.equal(
    rescheduleSnapshot(session, context, session.teacherId),
    undefined,
  );
});

test("CONFIRMED/READY use the 60-minute cutoff; ONGOING and terminal states cannot offer rescheduling", () => {
  const { session } = sessionPath(),
    now = Date.parse(session.startAt) - 3_600_000;
  for (const status of ["CONFIRMED", "READY"]) {
    assert.equal(isRescheduleEligible({ ...session, status }, now), true);
    assert.equal(isRescheduleEligible({ ...session, status }, now + 1), false);
    assert.match(
      rescheduleAvailabilityMessage({ ...session, status }, now),
      /Hai bên cần xác nhận/,
    );
  }
  for (const status of [
    "ONGOING",
    "COMPLETED",
    "CANCELLED",
    "DISPUTED",
    "AWAITING_CONFIRMATION",
  ])
    assert.equal(isRescheduleEligible({ ...session, status }, now), false);
});
