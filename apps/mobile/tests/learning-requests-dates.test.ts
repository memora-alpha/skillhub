import assert from "node:assert/strict";
import test from "node:test";
import {
  pickerValue,
  selectDatePart,
  slotRows,
  slotRowsValue,
  webDateChoice,
} from "../src/features/learning-requests/utils/request-dates";
import {
  draftToInput,
  requestDefaults,
  requestFormSchema,
} from "../src/features/learning-requests/schemas/request-form";
import { fixtureRequest } from "./fixtures/learning-requests-data";

test("an incomplete picker row fails validation; removing it explicitly clears slots", () => {
  const initial = fixtureRequest(),
    draft = requestDefaults(initial);
  const partial = slotRowsValue([{ startAt: "", endAt: "" }]);
  assert.equal(slotRows(partial).length, 1);
  assert.equal(
    requestFormSchema(initial).safeParse({ ...draft, preferredSlots: partial })
      .success,
    false,
  );
  assert.deepEqual(
    draftToInput({ ...draft, preferredSlots: slotRowsValue([]) }, initial)
      .preferredSlots,
    [],
  );
});

test("LR availability can be shorter than one hour or longer than three; only actual Sessions have the SRS duration limit", () => {
  const now = new Date(2027, 1, 1).getTime(),
    initial = fixtureRequest(),
    draft = requestDefaults(initial);
  for (const endAt of ["2027-02-02T09:30", "2027-02-02T16:00"]) {
    const input = draftToInput(
      {
        ...draft,
        preferredSlots: slotRowsValue([{ startAt: "2027-02-02T09:00", endAt }]),
      },
      initial,
      now,
    );
    assert.equal(input.preferredSlots.length, 1);
  }
});

test("legacy contract rejects missing/reversed/equal times and allows future overnight ranges", () => {
  const now = new Date(2027, 1, 1).getTime(),
    initial = fixtureRequest(),
    draft = requestDefaults(initial);
  for (const row of [
    { startAt: "2027-02-02", endAt: "2027-02-02" },
    { startAt: "2027-02-02T09:00", endAt: "2027-02-02T09:00" },
    { startAt: "2027-02-02T09:00", endAt: "2027-02-02T08:00" },
  ])
    assert.equal(
      requestFormSchema(initial, now).safeParse({
        ...draft,
        preferredSlots: slotRowsValue([row]),
      }).success,
      false,
    );
  assert.equal(
    requestFormSchema(initial, now).safeParse({
      ...draft,
      preferredSlots: "2027-02-02T22:00 → 2027-02-03T01:00",
    }).success,
    true,
  );
});

test("unchanged legacy overnight timestamps remain exact when the editor no longer offers date ranges", () => {
  const from = new Date(2027, 1, 2, 22, 0, 12, 345),
    to = new Date(2027, 1, 3, 1, 0, 45, 678);
  const initial = fixtureRequest({
    preferredSlots: [{ startAt: from.toISOString(), endAt: to.toISOString() }],
  });
  const draft = requestDefaults(initial);
  assert.deepEqual(
    draftToInput(draft, initial, from.getTime() + 60_000).preferredSlots,
    initial.preferredSlots,
  );
});
test("display/serialization of unchanged slot rows retains exact server timestamps", () => {
  const initial = fixtureRequest(),
    draft = requestDefaults(initial);
  const next = {
    ...draft,
    preferredSlots: slotRowsValue(slotRows(draft.preferredSlots)),
  };
  assert.equal(next.preferredSlots, draft.preferredSlots);
  assert.deepEqual(
    draftToInput(next, initial).preferredSlots,
    initial.preferredSlots,
  );
  assert.equal(
    draftToInput(next, initial).expiresAt,
    initial.requestedExpiresAt,
  );
});
test("calendar selection keeps the local time, time selection keeps the chosen day across month boundaries", () => {
  const initial = new Date(2027, 0, 31, 19, 45);
  const day = selectDatePart(initial, new Date(2027, 1, 2, 0, 0), "date");
  assert.equal(pickerValue(day), "2027-02-02T19:45");
  const time = selectDatePart(day, new Date(2027, 6, 8, 21, 30), "time");
  assert.equal(pickerValue(time), "2027-02-02T21:30");
  assert.equal(pickerValue(initial), "2027-01-31T19:45");
});
test("web date/time choices reject impossible values and convert local selections to API timestamps", () => {
  const date = new Date(2027, 0, 31, 19, 45);
  assert.equal(webDateChoice(date, "2027-02-30", "date"), undefined);
  assert.equal(webDateChoice(date, "25:00", "time"), undefined);
  const day = webDateChoice(date, "2027-02-02", "date")!;
  assert.equal(pickerValue(day), "2027-02-02T19:45");
  const end = webDateChoice(day, "21:30", "time")!;
  const initial = fixtureRequest(),
    draft = requestDefaults(initial);
  const input = draftToInput(
    {
      ...draft,
      preferredSlots: slotRowsValue([
        { startAt: pickerValue(day), endAt: pickerValue(end) },
      ]),
      expiresAt: "",
    },
    initial,
    date.getTime() - 60_000,
  );
  assert.deepEqual(input.preferredSlots, [
    { startAt: day.toISOString(), endAt: end.toISOString() },
  ]);
  assert.equal(input.expiresAt, null);
});
