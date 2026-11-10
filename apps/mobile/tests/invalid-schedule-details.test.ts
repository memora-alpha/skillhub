import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import { readPayload } from "../src/lib/http/response";
import {
  agreementPath,
  withConfirmedSchedules,
} from "./fixtures/learning-agreement";
import { scheduleTimeDetails } from "./fixtures/invalid-schedule-details";

function errorFor(
  details: unknown,
  status = 409,
  message = "INVALID_SCHEDULE_ITEMS",
) {
  try {
    readPayload(status, { success: false, message, details });
  } catch (error) {
    assert.ok(error instanceof AppError);
    return error;
  }
  assert.fail("Expected a rejected response");
}

test("HTTP invalid-time details retain both directions, server policy and invalid end/start order", () => {
  const details = scheduleTimeDetails(
    withConfirmedSchedules(agreementPath(true)),
  );
  details.invalidItems[1]!.endAt = details.invalidItems[1]!.startAt;
  const payload = {
    ...details,
    privateNote: "hidden",
    invalidItems: details.invalidItems.map((item) => ({
      ...item,
      privateNote: "hidden",
    })),
  };
  assert.deepEqual(errorFor(payload).details, details);
});

test("HTTP invalid-time details accept each backend reason and discard malformed or unrelated payloads", () => {
  const details = scheduleTimeDetails(withConfirmedSchedules());
  for (const reason of [
    "START_NOT_IN_FUTURE",
    "END_NOT_AFTER_START",
    "DURATION_TOO_SHORT",
    "DURATION_TOO_LONG",
  ]) {
    const payload = {
      ...details,
      invalidItems: [{ ...details.invalidItems[0]!, reasons: [reason] }],
    };
    assert.deepEqual(errorFor(payload).details, payload);
  }
  const item = details.invalidItems[0]!;
  for (const invalid of [
    undefined,
    { ...details, invalidItems: [] },
    { ...details, invalidItems: Array.from({ length: 201 }, () => item) },
    { ...details, evaluatedAt: "invalid" },
    { ...details, durationMinutes: { min: 120, max: 45 } },
    ...[
      { planId: "not-a-uuid" },
      { planVersion: 0 },
      { scheduleVersion: 1.5 },
      { teacherId: item.learnerId },
      { sessionNo: -1 },
      { startAt: "invalid" },
      { reasons: [] },
      { reasons: ["ARBITRARY_SERVER_MESSAGE"] },
      { reasons: ["START_NOT_IN_FUTURE", "START_NOT_IN_FUTURE"] },
    ].map((change) => ({ ...details, invalidItems: [{ ...item, ...change }] })),
  ])
    assert.equal(errorFor(invalid).details, undefined);
  assert.equal(errorFor(details, 500).details, undefined);
  assert.equal(errorFor(details, 409, "UNRELATED").details, undefined);
});
