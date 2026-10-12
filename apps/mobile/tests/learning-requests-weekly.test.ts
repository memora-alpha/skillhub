import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import {
  validWeeklyRows,
  weeklyRows,
  weeklyRowsValue,
  type WeeklyRow,
} from "../src/features/learning-requests/utils/request-weekly-slots";
import {
  requestDefaults,
  requestFormSchema,
  draftToInput,
} from "../src/features/learning-requests/schemas/request-form";
import { rebaseRequestDraft } from "../src/features/learning-requests/utils/request-recovery";
import { fixtureRequest } from "./fixtures/learning-requests-data";

const row: WeeklyRow = { weekday: "MON", startTime: "19:00", endTime: "21:00" };
test("weekly choices remain weekday/clock data without an invented calendar date", () => {
  const value = weeklyRowsValue([row]);
  assert.deepEqual(weeklyRows(value), [row]);
  assert.equal(validWeeklyRows(value), true);
  assert.equal(value.includes("startAt"), false);
  assert.equal(validWeeklyRows(""), true);
  assert.equal(weeklyRowsValue([]), "");
});
test("weekly clock validation rejects missing day/hour, reversed/equal time and midnight overflow", () => {
  for (const changed of [
    { weekday: "" },
    { startTime: "" },
    { endTime: "19:00" },
    { endTime: "18:00" },
    { endTime: "24:00" },
    { startTime: "9:00" },
    { endTime: "21:60" },
  ])
    assert.equal(
      validWeeklyRows(weeklyRowsValue([{ ...row, ...changed } as WeeklyRow])),
      false,
    );
});
test("weekly choices reject overlapping same-day hours but allow adjacency and different weekdays", () => {
  assert.equal(
    validWeeklyRows(
      weeklyRowsValue([row, { ...row, startTime: "20:00", endTime: "22:00" }]),
    ),
    false,
  );
  assert.equal(
    validWeeklyRows(
      weeklyRowsValue([row, { ...row, startTime: "21:00", endTime: "22:00" }]),
    ),
    true,
  );
  assert.equal(
    validWeeklyRows(weeklyRowsValue([row, { ...row, weekday: "SUN" }])),
    true,
  );
});
test("weekly UI allows five rows and availability outside Session duration limits", () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({
    ...row,
    startTime: `0${i}:00`,
    endTime: `0${i}:30`,
  }));
  assert.equal(validWeeklyRows(weeklyRowsValue(rows)), true);
  assert.equal(validWeeklyRows(weeklyRowsValue([...rows, row])), false);
  assert.equal(
    validWeeklyRows(
      weeklyRowsValue([{ ...row, startTime: "09:00", endTime: "16:00" }]),
    ),
    true,
  );
  assert.equal(weeklyRows("{broken"), undefined);
});
test("selected weekly draft blocks API conversion instead of discarding it or mapping to next occurrence", () => {
  const initial = fixtureRequest();
  const draft = {
    ...requestDefaults(initial),
    weeklyAvailability: weeklyRowsValue([row]),
  };
  const snapshot = structuredClone(draft);
  assert.equal(requestFormSchema(initial).safeParse(draft).success, true);
  assert.throws(
    () => draftToInput(draft, initial),
    (error) =>
      error instanceof ZodError &&
      error.issues[0]?.path[0] === "weeklyAvailability",
  );
  assert.deepEqual(draft, snapshot);
  const input = draftToInput({ ...draft, weeklyAvailability: "" }, initial);
  assert.deepEqual(input.preferredSlots, initial.preferredSlots);
  assert.equal("weeklyAvailability" in input, false);
});
test("weekly draft survives explicit conflict rebase and is cleared by discarded/new server defaults", () => {
  const initial = fixtureRequest();
  const draft = {
    ...requestDefaults(initial),
    weeklyAvailability: weeklyRowsValue([row]),
  };
  const latest = {
    ...initial,
    version: initial.version + 1,
    title: "Server changed this title",
  };
  assert.equal(
    rebaseRequestDraft(initial, draft, latest).weeklyAvailability,
    draft.weeklyAvailability,
  );
  assert.equal(requestDefaults(latest).weeklyAvailability, "");
});
