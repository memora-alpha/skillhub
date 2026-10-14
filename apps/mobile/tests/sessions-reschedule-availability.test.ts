import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRescheduleDraft,
  rescheduleAvailability,
} from "../src/features/sessions/utils/reschedule-form";
import { sessionRecord, now } from "./fixtures/sessions-client";

test("reschedule stays unavailable without a real read contract/version", () => {
  const s = sessionRecord();
  s.startAt = "2026-10-15T02:00:00Z";
  s.endAt = "2026-10-15T03:00:00Z";
  assert.equal(rescheduleAvailability(s, now).available, false);
  const draft = buildRescheduleDraft(
    { start: "2026-10-15T12:00", duration: "60" },
    now,
  );
  assert.equal("expectedVersion" in draft, false);
  assert.equal("meConfirmed" in draft, false);
  assert.equal("reason" in draft, false);
});
test("valid local time maps to an instant and duration is strictly 60–180 minutes", () => {
  for (const duration of ["60", "180"]) {
    const draft = buildRescheduleDraft(
      { start: "2026-10-15T12:00", duration },
      now,
    );
    assert.equal(
      Date.parse(draft.endAt) - Date.parse(draft.startAt),
      Number(duration) * 60000,
    );
  }
  for (const duration of ["59", "181", "90.5", "-60", ""]) {
    assert.throws(() =>
      buildRescheduleDraft({ start: "2026-10-15T12:00", duration }, now),
    );
  }
  for (const start of [
    "2026-02-30T12:00",
    "2026-10-15T25:00",
    "2020-01-01T12:00",
  ]) {
    assert.throws(() => buildRescheduleDraft({ start, duration: "60" }, now));
  }
});
