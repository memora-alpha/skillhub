import assert from "node:assert/strict";
import test from "node:test";
import {
  agreementConfirmed,
  canReschedule,
  editOwnPlan,
  finalValidation,
  hasConflict,
  plansConfirmed,
  validSlots,
} from "../src/features/learning-paths/rules";
import type { LearningPath, Plan } from "../src/features/learning-paths/types";
const now = Date.parse("2026-10-10T00:00:00Z");
function plan(id: string, mine: boolean, hour: number): Plan {
  return {
    id,
    teacher: mine ? "me" : "partner",
    learner: mine ? "partner" : "me",
    skill: "React",
    goal: "Apprendre React",
    outline: ["Component"],
    version: 3,
    learnerVersion: 3,
    schedule: {
      version: 2,
      meVersion: 2,
      partnerVersion: 2,
      slots: [{ startAt: `2026-10-11T${hour}:00:00Z`, duration: 90 }],
    },
  };
}
function path(type: "TWO_WAY" | "ONE_WAY" = "TWO_WAY"): LearningPath {
  return {
    id: "test",
    title: "Test",
    partner: "Partner",
    type,
    teacher: type === "ONE_WAY" ? "partner" : undefined,
    credit: type === "ONE_WAY" ? "10.50" : "40.25",
    version: 5,
    meVersion: 5,
    partnerVersion: 5,
    status: "PROPOSED",
    completedSessions: 0,
    plans:
      type === "ONE_WAY"
        ? [plan("b", false, 10)]
        : [plan("a", true, 10), plan("b", false, 14)],
  };
}
test("two-way requires opposing plans and current learner confirmations even when terms are confirmed", () => {
  const p = path();
  assert.equal(agreementConfirmed(p), true);
  for (const plans of [
    [p.plans[0]!],
    [
      p.plans[0]!,
      { ...p.plans[1]!, teacher: "me" as const, learner: "partner" as const },
    ],
    [p.plans[0]!, { ...p.plans[1]!, learnerVersion: 2 }],
  ])
    assert.equal(plansConfirmed({ ...p, plans }), false);
  assert.match(
    finalValidation(
      { ...p, partnerVersion: 4 },
      { me: 100, partner: 100 },
      now,
    )!,
    /xác nhận/,
  );
});
test("one-way validates only the learner wallet and permits credit below 20", () => {
  const p = path("ONE_WAY");
  assert.equal(finalValidation(p, { me: 11, partner: 0 }, now), undefined);
  assert.match(finalValidation(p, { me: 10, partner: 100 }, now)!, /Số dư/);
  assert.equal(plansConfirmed({ ...p, teacher: "me" }), false);
});
test("two-way requires enough credit for both holders; validation cannot accept stale schedules", () => {
  const p = path();
  assert.match(finalValidation(p, { me: 100, partner: 40 }, now)!, /Số dư/);
  assert.match(
    finalValidation({ ...p, credit: "19.99" }, { me: 100, partner: 100 }, now)!,
    /Credit/,
  );
  p.plans[1]!.schedule!.partnerVersion = 1;
  assert.match(
    finalValidation(p, { me: 100, partner: 100 }, now)!,
    /từng lịch/,
  );
});
test("editing a teacher's own plan invalidates confirmation and all unheld schedules without mutating the source", () => {
  const p = path();
  const updated = editOwnPlan(p, "a", {
    skill: "TypeScript",
    goal: "Build a typed app",
    outline: ["Types", "Generics"],
  })!;
  assert.equal(updated.version, 6);
  assert.equal(updated.meVersion, undefined);
  assert.equal(updated.partnerVersion, undefined);
  assert.equal(updated.plans[0]!.version, 4);
  assert.equal(updated.plans[0]!.learnerVersion, undefined);
  assert.ok(updated.plans.every((p) => !p.schedule));
  assert.equal(p.plans[0]!.version, 3);
  assert.equal(
    editOwnPlan(p, "b", { skill: "X", goal: "X", outline: ["X"] }),
    undefined,
  );
  assert.equal(
    editOwnPlan({ ...p, status: "ACTIVE" }, "a", {
      skill: "X",
      goal: "X",
      outline: ["X"],
    }),
    undefined,
  );
});
test("duration, session count, future time and overlap are checked across both plans", () => {
  const slots = [{ startAt: "2026-10-11T10:00:00Z", duration: 60 }];
  assert.equal(validSlots(slots, 1, now), undefined);
  assert.ok(validSlots(slots, 2, now));
  assert.ok(validSlots([{ ...slots[0]!, duration: 59 }], 1, now));
  assert.ok(validSlots([{ ...slots[0]!, duration: 181 }], 1, now));
  assert.ok(validSlots(slots, 1, Date.parse("2026-10-12")));
  assert.equal(
    hasConflict([slots[0]!, { startAt: "2026-10-11T11:00:00Z", duration: 60 }]),
    false,
  );
  const p = path();
  p.plans[1]!.schedule!.slots[0]!.startAt = "2026-10-11T11:00:00Z";
  assert.match(finalValidation(p, { me: 100, partner: 100 }, now)!, /trùng/);
});
test("reschedule cutoff permits exactly 60 minutes and rejects late or malformed times", () => {
  assert.equal(canReschedule(new Date(now + 3600000).toISOString(), now), true);
  assert.equal(
    canReschedule(new Date(now + 3599999).toISOString(), now),
    false,
  );
  assert.equal(canReschedule("invalid", now), false);
});
test("hold checks other locked sessions and allows adjacent slots", () => {
  const p = path();
  const slot = p.plans[0]!.schedule!.slots[0]!;
  assert.match(
    finalValidation(p, { me: 100, partner: 100 }, now, [slot])!,
    /lộ trình khác/,
  );
  assert.equal(
    finalValidation(p, { me: 100, partner: 100 }, now, [
      {
        startAt: new Date(Date.parse(slot.startAt) - 3600000).toISOString(),
        duration: 60,
      },
    ]),
    undefined,
  );
});
