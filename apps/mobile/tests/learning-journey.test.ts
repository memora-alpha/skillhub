import assert from "node:assert/strict";
import test from "node:test";
import { learningJourney } from "../src/features/learning-paths/journey";
import {
  journeyIds as ids,
  journeyPath,
} from "./fixtures/learning-journey-data";

test("guidance directs each participant to their own work without creating the opposite plan", () => {
  const path = journeyPath();
  path.plans = [];
  assert.equal(
    learningJourney(path, ids.me).action?.href,
    `/paths/${path.id}/plans/new`,
  );
  path.plans = [journeyPath().plans[0]!];
  assert.ok(
    learningJourney(path, ids.me).waiting.includes(
      "Người trao đổi tạo nội dung phần họ dạy.",
    ),
  );
  assert.equal(learningJourney(path, ids.me).action, undefined);
  assert.equal(
    learningJourney(path, ids.other).action?.href,
    `/paths/${path.id}/plans/new`,
  );
});
test("ONE_WAY learner waits for teacher and reviews only their incoming plan", () => {
  const path = journeyPath();
  path.agreement = {
    ...path.agreement,
    exchangeType: "ONE_WAY",
    teacherId: ids.other,
    learnerId: ids.me,
    totalCreditPerUser: null,
    negotiatedCredit: "100.00",
  };
  path.plans = [];
  assert.equal(learningJourney(path, ids.me).action, undefined);
  assert.equal(
    learningJourney(path, ids.other).action?.href,
    `/paths/${path.id}/plans/new`,
  );
  path.plans = [journeyPath().plans[1]!];
  assert.equal(
    learningJourney(path, ids.me).action?.href,
    `/paths/${path.id}/plans/${path.plans[0]!.id}`,
  );
});
test("separate plan, agreement and schedule confirmations gate progress", () => {
  const path = journeyPath();
  assert.equal(
    learningJourney(path, ids.me).action?.href,
    `/paths/${path.id}/plans/${path.plans[1]!.id}`,
  );
  path.plans.forEach((plan) => {
    plan.status = "CONFIRMED";
    plan.learnerConfirmedAt = "2026-10-19T12:00:00Z";
  });
  assert.equal(learningJourney(path, ids.me).step, 2);
  assert.equal(
    learningJourney(path, ids.me).title,
    "Xem lại hình thức và Credit",
  );
  path.agreement.participantAConfirmedAt = "2026-10-19T12:00:00Z";
  assert.equal(learningJourney(path, ids.me).title, "Đang chờ người trao đổi");
  const ready = journeyPath(true);
  ready.plans[0]!.schedule = null;
  assert.equal(
    learningJourney(ready, ids.me).action?.href,
    `/paths/${path.id}/schedules/${ready.plans[0]!.id}`,
  );
  ready.plans[0]!.schedule = journeyPath(true).plans[0]!.schedule;
  ready.plans[1]!.schedule!.participantAConfirmedAt = null;
  assert.equal(learningJourney(ready, ids.me).step, 3);
  assert.equal(
    learningJourney(ready, ids.me).action?.href,
    `/paths/${path.id}/schedules`,
  );
  assert.equal(learningJourney(journeyPath(true), ids.me).step, 4);
});
test("foreign users, terminal schedules and locked paths never offer a confirmation or finalize shortcut", () => {
  assert.equal(learningJourney(journeyPath(true), "foreign").action, undefined);
  for (const status of ["CANCELLED", "EXPIRED", "NEEDS_REVISION"] as const) {
    const path = journeyPath(true);
    path.plans[0]!.schedule!.status = status;
    assert.equal(learningJourney(path, ids.me).step, 3);
  }
  for (const status of [
    "SCHEDULED",
    "ACTIVE",
    "COMPLETED",
    "DISPUTED",
  ] as const) {
    const path = journeyPath(true);
    path.status = status;
    path.lockedVersion = 1;
    assert.equal(
      learningJourney(path, ids.me).action?.href,
      `/paths/${path.id}/schedules`,
    );
  }
});
