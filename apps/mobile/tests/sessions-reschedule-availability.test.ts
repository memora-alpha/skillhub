import assert from "node:assert/strict";
import test from "node:test";
import {
  rescheduleFormSchema,
  rescheduleAvailabilityMessage,
  isRescheduleEligible,
} from "../src/features/sessions/utils/reschedule-form";
import { sessionRecord, now } from "./fixtures/sessions-client";

test("reschedule explains bilateral confirmation before the cutoff and unavailability after it", () => {
  const session = {
    ...sessionRecord(),
    startAt: new Date(now + 3_600_000).toISOString(),
  };
  assert.match(
    rescheduleAvailabilityMessage(session, now),
    /Hai bên cần xác nhận/,
  );
  assert.match(
    rescheduleAvailabilityMessage(session, now + 1),
    /không còn đủ điều kiện/,
  );
});

test("makeup uses its own deadline and server permission after the original session ended", () => {
  const session = {
    ...sessionRecord(),
    status: "MAKEUP_REQUIRED" as const,
    allowedActions: ["PROPOSE_MAKEUP" as const],
    deadlines: {
      confirmBy: null,
      excuseOrReportBy: null,
      makeupBy: new Date(now + 1000).toISOString(),
    },
  };
  assert.ok(Date.parse(session.endAt) <= now);
  assert.equal(isRescheduleEligible(session, now), true);
  assert.doesNotMatch(
    rescheduleAvailabilityMessage(session, now),
    /60 phút|lịch cũ/,
  );
  assert.equal(isRescheduleEligible(session, now + 1000), false);
  assert.match(rescheduleAvailabilityMessage(session, now + 1000), /hết hạn/);
  assert.equal(
    isRescheduleEligible({ ...session, allowedActions: [] }, now),
    false,
  );
  assert.equal(
    isRescheduleEligible({ ...session, deadlines: undefined }, now),
    false,
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
