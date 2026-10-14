import assert from "node:assert/strict";
import test from "node:test";
import { sessionSchedule } from "../src/features/sessions/utils/session-schedule";

test("schedule displays time range in the device timezone", () => {
  const result = sessionSchedule(
    {
      startAt: "2026-10-15T05:38:00Z",
      endAt: "2026-10-15T07:08:00Z",
    },
    "Asia/Ho_Chi_Minh",
  );
  assert.equal(result.time, "12:38 — 14:08");
  assert.match(result.date, /15/);
  assert.equal(result.date.includes(" — "), false);
});

test("overnight session preserves both local dates", () => {
  const result = sessionSchedule(
    {
      startAt: "2026-10-15T16:30:00Z",
      endAt: "2026-10-15T18:00:00Z",
    },
    "Asia/Ho_Chi_Minh",
  );
  assert.equal(result.time, "23:30 — 01:00");
  const dates = result.date.split(" — ");
  assert.equal(dates.length, 2);
  assert.match(dates[0]!, /15/);
  assert.match(dates[1]!, /16/);
});

test("schedule respects a daylight-saving offset change", () => {
  const result = sessionSchedule(
    {
      startAt: "2026-11-01T05:30:00Z",
      endAt: "2026-11-01T07:00:00Z",
    },
    "America/New_York",
  );
  assert.equal(result.time, "01:30 — 02:00");
  assert.equal(result.date.includes(" — "), false);
});

test("calendar tile uses the local date when UTC is still the previous day", () => {
  const result = sessionSchedule(
    { startAt: "2026-10-14T18:00:00Z", endAt: "2026-10-14T19:00:00Z" },
    "Asia/Ho_Chi_Minh",
  );
  assert.equal(result.day, "15");
  assert.equal(result.month, "10");
  assert.equal(result.time, "01:00 — 02:00");
});
