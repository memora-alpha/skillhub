import assert from "node:assert/strict";
import test from "node:test";
import { invalidScheduleItems } from "../src/features/learning-paths/utils/invalid-schedule-items";
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
