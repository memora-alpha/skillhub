import assert from "node:assert/strict";
import { test } from "node:test";
import { generateWeeklySchedule } from "../src/features/learning-paths/utils/weekly-schedule";
import { scheduleItems } from "../src/features/learning-paths/schemas/schedule-input";
import { parseLocalDateTime } from "../src/utils/local-date-time";

test("weekly generator starts on or after the chosen date, sorts weekdays across year boundaries and preserves local time", () => {
  const items = generateWeeklySchedule(
    { start: "2098-12-30T19:30", days: [6, 2, 4, 2], minutes: "90" },
    8,
  );
  assert.equal(items.length, 8);
  let previous = 0;
  for (const item of items) {
    const date = parseLocalDateTime(item.local)!;
    assert.ok([2, 4, 6].includes(date.getDay()));
    assert.ok(item.local >= "2098-12-30T19:30");
    assert.ok(date.getTime() > previous);
    assert.ok(item.local.endsWith("T19:30"));
    assert.equal(item.minutes, "90");
    previous = date.getTime();
  }
  assert.ok(items.at(-1)!.local.startsWith("2099"));
  const api = scheduleItems({ items });
  assert.deepEqual(
    api.map((item) => item.sessionNo),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.ok(
    api.every(
      (item) =>
        Date.parse(item.endAt) - Date.parse(item.startAt) === 90 * 60000,
    ),
  );
});

test("weekly generator includes starting weekday and can produce 100 weekly sessions without mutating inputs", () => {
  const start = "2098-02-01T09:05";
  const days = [parseLocalDateTime(start)!.getDay()];
  const input = { start, days, minutes: "60" };
  const items = generateWeeklySchedule(input, 100);
  assert.equal(items[0]!.local, start);
  assert.equal(items.length, 100);
  assert.ok(
    items.every((item) => parseLocalDateTime(item.local)!.getDay() === days[0]),
  );
  assert.deepEqual(input, { start, days, minutes: "60" });
});

test("weekly generator rejects invalid, past or empty choices and invalid durations before replacing the draft", () => {
  const input = { start: "2098-01-01T19:30", days: [1], minutes: "60" };
  for (const update of [
    { start: "" },
    { start: "2098-02-30T19:30" },
    { start: "2000-01-01T19:30" },
    { days: [] },
    { days: [7] },
    { days: [1.5] },
    { minutes: "59" },
    { minutes: "181" },
    { minutes: "60.5" },
  ])
    assert.throws(() => generateWeeklySchedule({ ...input, ...update }, 3));
  for (const count of [0, 101, 2.5])
    assert.throws(() => generateWeeklySchedule(input, count));
  assert.equal(
    generateWeeklySchedule({ ...input, minutes: "180" }, 1)[0]!.minutes,
    "180",
  );
});
