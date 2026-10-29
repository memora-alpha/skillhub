import assert from "node:assert/strict";
import test from "node:test";
import { inboxTime } from "../src/features/messages/utils/chat-dates";

const local = (
  year: number,
  month: number,
  day: number,
  hour = 9,
  minute = 5,
) => new Date(year, month - 1, day, hour, minute);

test("inbox uses time today, weekdays in this calendar week and dates for earlier weeks", () => {
  const sunday = local(2026, 10, 25, 15);
  assert.equal(inboxTime(local(2026, 10, 25).toISOString(), sunday), "09:05");
  assert.equal(inboxTime(local(2026, 10, 19).toISOString(), sunday), "Th 2");
  assert.equal(inboxTime(local(2026, 10, 24).toISOString(), sunday), "Th 7");
  assert.equal(
    inboxTime(local(2026, 10, 18).toISOString(), sunday),
    "18 thg 10",
  );
  const monday = local(2026, 10, 26);
  assert.equal(
    inboxTime(local(2026, 10, 25, 23, 59).toISOString(), monday),
    "25 thg 10",
  );
});

test("inbox week boundaries follow local calendar dates across months and years", () => {
  const now = local(2027, 1, 1);
  assert.equal(inboxTime(local(2026, 12, 31).toISOString(), now), "Th 5");
  assert.equal(
    inboxTime(local(2026, 12, 27).toISOString(), now),
    "27 thg 12, 2026",
  );
  assert.equal(
    inboxTime(local(2026, 9, 30).toISOString(), local(2026, 10, 1)),
    "Th 4",
  );
  assert.equal(inboxTime("invalid", now), "");
});
