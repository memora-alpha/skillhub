import assert from "node:assert/strict";
import test from "node:test";
import {
  invalidScheduleItems,
  serverInvalidScheduleItems,
  scheduleValidationKey,
} from "../src/features/learning-paths/utils/invalid-schedule-items";
import type { InvalidScheduleDetails } from "../src/lib/http/scheduling-error";
import { scheduleTimeDetails } from "./fixtures/invalid-schedule-details";
import {
  agreementPath,
  withConfirmedSchedules,
} from "./fixtures/learning-agreement";

test("invalid times identify the correct direction and session, including both teachers", () => {
  const path = withConfirmedSchedules(agreementPath(true));
  const now = Date.parse("2030-01-02T12:00:00Z");
  let issues = invalidScheduleItems(path, now);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.plan.id, path.plans[0]!.id);
  assert.equal(issues[0]!.items[0]!.sessionNo, 1);
  assert.deepEqual(issues[0]!.items[0]!.reasons, ["giờ bắt đầu đã qua"]);
  const other = path.plans[1]!.schedule!.items[0]!;
  other.endAt = "2030-01-02T14:30:00Z";
  issues = invalidScheduleItems(path, now);
  assert.equal(issues.length, 2);
  assert.equal(issues[1]!.plan.teacherId, path.plans[1]!.teacherId);
  assert.match(issues[1]!.items[0]!.reasons.join(), /30 phút/);
});

test("server reasons override device estimates, preserve every session and use the server duration policy", () => {
  const path = withConfirmedSchedules(agreementPath(true));
  path.plans[1]!.schedule!.items[0]!.endAt = "2030-01-02T17:00:00Z";
  const details: InvalidScheduleDetails = scheduleTimeDetails(path);
  details.invalidItems[0]!.reasons = ["DURATION_TOO_SHORT"];
  details.durationMinutes.min = 90;
  details.invalidItems[1]!.reasons = ["DURATION_TOO_LONG"];
  // Mapping uses the supplied reasons only, even if the device would flag time.
  let issues = serverInvalidScheduleItems(path, details)!;
  assert.equal(issues.length, 2);
  assert.equal(issues[0]!.plan.teacherId, path.plans[0]!.teacherId);
  assert.equal(issues[1]!.plan.teacherId, path.plans[1]!.teacherId);
  assert.deepEqual(issues[0]!.items[0]!.reasons, [
    "thời lượng 60 phút, tối thiểu 90 phút",
  ]);
  assert.deepEqual(issues[1]!.items[0]!.reasons, [
    "thời lượng 180 phút, tối đa 120 phút",
  ]);
  const slot = path.plans[0]!.schedule!.items[0]!;
  path.plans[0]!.schedule!.items.push({
    ...slot,
    sessionNo: 2,
    endAt: slot.startAt,
  });
  details.invalidItems.push({
    ...details.invalidItems[0]!,
    sessionNo: 2,
    endAt: slot.startAt,
    reasons: ["START_NOT_IN_FUTURE", "END_NOT_AFTER_START"],
  });
  issues = serverInvalidScheduleItems(path, details)!;
  assert.equal(issues[0]!.items.length, 2);
  assert.match(
    issues[0]!.items[1]!.reasons.join(),
    /giờ bắt đầu đã qua.*kết thúc/,
  );
});

test("server errors cannot be attached to a different owner, schedule, version or item", () => {
  const path = withConfirmedSchedules();
  const details = scheduleTimeDetails(path);
  const item = details.invalidItems[0]!;
  for (const change of [
    { planId: path.conversationId },
    { planVersion: item.planVersion + 1 },
    { scheduleId: path.conversationId },
    { scheduleVersion: item.scheduleVersion + 1 },
    { teacherId: item.learnerId, learnerId: item.teacherId },
    { sessionNo: 2 },
    { startAt: "2031-01-02T10:00:00.000Z" },
    { endAt: "2031-01-02T11:00:00.000Z" },
  ]) {
    assert.equal(
      serverInvalidScheduleItems(path, {
        ...details,
        invalidItems: [{ ...item, ...change }],
      }),
      undefined,
    );
  }
  path.plans[0]!.schedule = null;
  assert.equal(serverInvalidScheduleItems(path, details), undefined);
});

test("validation snapshot tracks path version and ignores unrelated plan display fields", () => {
  const path = withConfirmedSchedules();
  const key = scheduleValidationKey(path);
  path.plans[0]!.learningGoal = "A presentation-only update";
  assert.equal(scheduleValidationKey(path), key);
  path.currentVersion++;
  assert.notEqual(scheduleValidationKey(path), key);
});

test("validation includes every affected session and handles boundaries without guessing", () => {
  const path = withConfirmedSchedules();
  const items = path.plans[0]!.schedule!.items;
  const start = Date.parse(items[0]!.startAt);
  assert.equal(invalidScheduleItems(path, start - 1).length, 0);
  assert.match(
    invalidScheduleItems(path, start)[0]!.items[0]!.reasons.join(),
    /đã qua/,
  );
  items.push({ ...items[0]!, sessionNo: 2, endAt: items[0]!.startAt });
  assert.match(
    invalidScheduleItems(path, start - 1)[0]!.items[0]!.reasons.join(),
    /kết thúc/,
  );
  items[1]!.endAt = new Date(start + 180 * 60_000).toISOString();
  assert.equal(invalidScheduleItems(path, start - 1).length, 0);
  items[1]!.endAt = new Date(start + 181 * 60_000).toISOString();
  assert.match(
    invalidScheduleItems(path, start - 1)[0]!.items[0]!.reasons.join(),
    /181 phút/,
  );
  items[1]!.startAt = "invalid";
  assert.match(
    invalidScheduleItems(path, start - 1)[0]!.items[0]!.reasons.join(),
    /ngày hoặc giờ/,
  );
  path.plans[0]!.schedule = null;
  assert.deepEqual(invalidScheduleItems(path, start), []);
});
