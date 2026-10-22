import assert from "node:assert/strict";
import test from "node:test";
import {
  rescheduleFormSchema,
  rescheduleUnavailableMessage,
} from "../src/features/sessions/utils/reschedule-form";
import { sessionRecord, now } from "./fixtures/sessions-client";

test("reschedule explains that submission is unavailable even before the cutoff", () => {
  const session = {
    ...sessionRecord(),
    startAt: new Date(now + 3_600_000).toISOString(),
  };
  assert.match(
    rescheduleUnavailableMessage(session, now),
    /chưa thể gửi đề nghị/,
  );
  assert.match(
    rescheduleUnavailableMessage(session, now + 1),
    /không còn đủ điều kiện/,
  );
});
test("the form accepts valid local dates and whole durations from 60 to 180 minutes", () => {
  for (const duration of ["60", "180"]) {
    assert.equal(
      rescheduleFormSchema.safeParse({ start: "2030-10-15T12:00", duration })
        .success,
      true,
    );
  }
  for (const duration of ["59", "181", "90.5", "-60", ""]) {
    assert.equal(
      rescheduleFormSchema.safeParse({ start: "2030-10-15T12:00", duration })
        .success,
      false,
    );
  }
  for (const start of ["2030-02-30T12:00", "2030-10-15T25:00", ""]) {
    assert.equal(
      rescheduleFormSchema.safeParse({ start, duration: "60" }).success,
      false,
    );
  }
});
