import assert from "node:assert/strict";
import { test } from "node:test";
import {
  previewScheduleItems,
  scheduleBusyRange,
  scheduleConflictMessage,
  scheduleConflicts,
  scheduleOverlap,
  scheduleSlotDraft,
  scheduleWindowLabel,
} from "../src/features/learning-paths/utils/schedule-conflicts";
import { scheduleInputSchema } from "../src/features/learning-paths/schemas/schedule-input";
import {
  agreementPath,
  withConfirmedSchedules,
} from "./fixtures/learning-agreement";

test("draft conflicts identify the affected session and the existing time window without repeating its own range", () => {
  const slots = previewScheduleItems([
    { local: "2098-01-02T19:00", minutes: "120" },
    { local: "2098-01-02T20:30", minutes: "60" },
  ]);
  const conflicts = scheduleConflicts(slots);
  assert.equal(conflicts.length, 1);
  const message = scheduleConflictMessage(conflicts[0]!);
  for (const text of ["Buổi 2", "buổi 1", "19:00", "21:00"])
    assert.ok(message.includes(text), message);
  assert.ok(message.includes(scheduleWindowLabel(slots[0]!)));
  const result = scheduleInputSchema.safeParse({
    items: slots.map(scheduleSlotDraft),
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(result.error.issues[0]!.path, ["items", 1, "local"]);
    assert.equal(result.error.issues[0]!.message, message);
  }
});

test("all overlapping pairs are found, including nested and unsorted sessions; adjacent sessions are allowed", () => {
  const nested = previewScheduleItems([
    { local: "2098-01-02T19:00", minutes: "180" },
    { local: "2098-01-02T19:30", minutes: "60" },
    { local: "2098-01-02T21:00", minutes: "60" },
  ]);
  assert.deepEqual(
    scheduleConflicts(nested).map((c) => [c.slot.sessionNo, c.other.sessionNo]),
    [
      [1, 2],
      [1, 3],
    ],
  );
  assert.equal(scheduleConflicts([...nested].reverse()).length, 2);
  assert.equal(
    scheduleConflicts(
      previewScheduleItems([
        { local: "2098-01-02T19:00", minutes: "60" },
        { local: "2098-01-02T20:00", minutes: "60" },
      ]),
    ).length,
    0,
  );
});

test("opposite-direction warnings name the other schedule, ignore retired proposals and update as the draft changes", () => {
  const path = withConfirmedSchedules(agreementPath(true));
  const other = path.plans[1]!;
  const slots = [...other.schedule!.items];
  const conflict = scheduleConflicts(slots, [other])[0]!;
  assert.equal(conflict.source, "counterpart");
  assert.match(scheduleConflictMessage(conflict), /lịch người còn lại dạy/);
  const moved = slots.map((slot) => ({
    ...slot,
    startAt: "2098-01-03T19:00:00Z",
    endAt: "2098-01-03T20:00:00Z",
  }));
  assert.equal(scheduleConflicts(moved, [other]).length, 0);
  for (const status of ["CANCELLED", "EXPIRED", "NEEDS_REVISION"] as const) {
    other.schedule!.status = status;
    assert.equal(scheduleConflicts(slots, [other]).length, 0);
  }
});

test("live previews retain original seconds and detect an overlap hidden by minute fields", () => {
  const original = {
    sessionNo: 1,
    startAt: "2098-01-01T19:30:27Z",
    endAt: "2098-01-01T20:30:27Z",
  };
  const second = {
    sessionNo: 2,
    startAt: "2098-01-01T20:30:00Z",
    endAt: "2098-01-01T21:30:00Z",
  };
  const input = [scheduleSlotDraft(original), scheduleSlotDraft(second)];
  const slots = previewScheduleItems(input, [original]);
  assert.deepEqual(slots[0], original);
  assert.equal(scheduleConflicts(previewScheduleItems(input)).length, 0);
  const overlap = scheduleOverlap(slots[0]!, slots[1]!)!;
  assert.equal(Date.parse(overlap.endAt) - Date.parse(overlap.startAt), 27_000);
  assert.match(scheduleWindowLabel(overlap), /:27/);
});

test("incomplete dates/durations do not produce false overlaps or throw while typing", () => {
  for (const item of [
    { local: "", minutes: "60" },
    { local: "2098-02-30T19:00", minutes: "60" },
    { local: "2098-01-01T19:00", minutes: "" },
    { local: "2098-01-01T19:00", minutes: "60.5" },
    { local: "2098-01-01T19:00", minutes: "181" },
  ])
    assert.deepEqual(previewScheduleItems([item]), []);
});

test("overnight overlaps show both dates and busy lookup includes sessions starting the previous day", () => {
  const slots = previewScheduleItems([
    { local: "2098-01-02T23:30", minutes: "120" },
    { local: "2098-01-03T00:30", minutes: "60" },
  ]);
  assert.equal(scheduleConflicts(slots).length, 1);
  const start = new Date(slots[0]!.startAt),
    end = new Date(slots[0]!.endAt);
  const label = scheduleWindowLabel(slots[0]!);
  assert.ok(label.includes(start.toLocaleDateString("vi-VN")));
  assert.ok(label.includes(end.toLocaleDateString("vi-VN")));
  const range = scheduleBusyRange(slots[0]!);
  assert.equal(new Date(range.from).getDate(), 1);
  assert.equal(new Date(range.dayEnd).getDate(), 4);
  assert.equal(new Date(range.dayStart).getDate(), 2);
  assert.equal(new Date(range.dayStart).getHours(), 0);
  const midnight = previewScheduleItems([
    { local: "2098-01-02T23:00", minutes: "60" },
  ])[0]!;
  assert.equal(new Date(scheduleBusyRange(midnight).dayEnd).getDate(), 3);
});
