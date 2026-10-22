import assert from "node:assert/strict";
import test from "node:test";
import { scheduleDirections } from "../src/features/learning-paths/utils/schedule-directions";
import {
  agreementPath,
  teacherId,
  learnerId,
} from "./fixtures/learning-agreement";

test("two-way keeps both schedule places when a plan or schedule is missing", () => {
  const path = agreementPath(true);
  path.plans.pop();
  for (const viewer of [teacherId, learnerId]) {
    const directions = scheduleDirections(path, viewer);
    assert.equal(directions.length, 2);
    assert.equal(directions[0]!.mine, true);
    assert.equal(directions[1]!.mine, false);
    assert.equal(directions.filter((direction) => !direction.plan).length, 1);
    assert.equal(
      directions.find((direction) => direction.plan)?.plan?.schedule,
      null,
    );
  }
  path.plans = [];
  assert.equal(scheduleDirections(path, teacherId).length, 2);
});

test("one-way shows only the agreed direction even if stale reciprocal data exists", () => {
  const path = agreementPath(true);
  path.agreement.exchangeType = "ONE_WAY";
  path.agreement.teacherId = teacherId;
  path.agreement.learnerId = learnerId;
  assert.equal(scheduleDirections(path, teacherId).length, 1);
  assert.equal(scheduleDirections(path, learnerId)[0]!.mine, false);
});
