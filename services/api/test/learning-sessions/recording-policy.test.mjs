import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACTIVE_RECORDING_STATUSES,
  canTransition,
  isActiveRecording,
  RECORDING_STATUSES,
  recordingExpiresAt,
  recordingObjectKey,
  recordingRequestCheck,
  recordingRequestExpired,
  recordingStopDeadline,
  responderError,
} from "../../dist/modules/learning-sessions/domain/recording.policy.js";
import { recordingStorageConfiguration } from "../../dist/modules/learning-sessions/infrastructure/livekit/recording-storage.config.js";

const join = { earlyMinutes: 10, lateMinutes: 10 };
// Session 10:00–11:00 UTC; the room is open 09:50–11:10.
const session = (status = "CONFIRMED") => ({
  status,
  startAt: new Date("2026-12-01T10:00:00Z"),
  endAt: new Date("2026-12-01T11:00:00Z"),
});
const at = (time) => new Date(`2026-12-01T${time}Z`);

test("requests are allowed only while the room is open and the Session is READY or ONGOING", () => {
  assert.deepEqual(recordingRequestCheck(session(), at("09:49:59"), join), {
    allowed: false,
    reason: "RECORDING_WINDOW_NOT_OPEN",
  });
  // A stored CONFIRMED Session is READY once the window opens.
  assert.deepEqual(recordingRequestCheck(session(), at("09:50:00"), join), {
    allowed: true,
    closesAt: at("11:10:00"),
  });
  assert.equal(
    recordingRequestCheck(session("ONGOING"), at("10:30:00"), join).allowed,
    true,
  );
  // After endAt the Session awaits confirmation: no new recordings, even in the late window.
  assert.equal(
    recordingRequestCheck(session("ONGOING"), at("11:00:00"), join).allowed,
    false,
  );
  for (const status of ["CANCELLED", "DISPUTED", "NO_SHOW", "COMPLETED"])
    assert.equal(
      recordingRequestCheck(session(status), at("10:30:00"), join).allowed,
      false,
    );
});

test("a missing or broken join policy refuses requests as not ready", () => {
  const notReady = { allowed: false, reason: "RECORDING_POLICY_NOT_READY" };
  assert.deepEqual(
    recordingRequestCheck(session(), at("10:00:00"), null),
    notReady,
  );
  assert.deepEqual(
    recordingRequestCheck(session(), at("10:00:00"), {
      earlyMinutes: -1,
      lateMinutes: 0,
    }),
    notReady,
  );
});

test("a recording stops at the earlier of the window close and its cap", () => {
  // Started 09:55: cap is 09:55 + 60 + 10 = 11:05, before the 11:10 close.
  assert.deepEqual(recordingStopDeadline(session(), at("09:55:00"), join, 10), {
    at: at("11:05:00"),
    reason: "MAX_DURATION",
  });
  // Started 10:30: cap would be 11:40, so the window close wins.
  assert.deepEqual(recordingStopDeadline(session(), at("10:30:00"), join, 10), {
    at: at("11:10:00"),
    reason: "WINDOW_CLOSED",
  });
  assert.equal(
    recordingStopDeadline(session(), at("10:00:00"), join, -1),
    null,
  );
});

test("the status machine allows only the spec transitions", () => {
  const allowed = [
    ["REQUESTED", "STARTING"],
    ["REQUESTED", "DECLINED"],
    ["REQUESTED", "REQUEST_EXPIRED"],
    ["STARTING", "RECORDING"],
    ["STARTING", "STOPPING"],
    ["STARTING", "READY"],
    ["STARTING", "FAILED"],
    ["RECORDING", "STOPPING"],
    ["RECORDING", "READY"],
    ["RECORDING", "FAILED"],
    ["STOPPING", "READY"],
    ["STOPPING", "FAILED"],
    ["READY", "EXPIRED"],
    ["READY", "DELETED"],
  ];
  const key = ([from, to]) => `${from}>${to}`;
  const expected = new Set(allowed.map(key));
  for (const from of RECORDING_STATUSES)
    for (const to of RECORDING_STATUSES)
      assert.equal(
        canTransition(from, to),
        expected.has(key([from, to])),
        key([from, to]),
      );
  assert.deepEqual(RECORDING_STATUSES.filter(isActiveRecording), [
    ...ACTIVE_RECORDING_STATUSES,
  ]);
});

test("requests expire after two minutes and recordings after the retention days", () => {
  assert.equal(recordingRequestExpired(at("10:00:00"), at("10:01:59")), false);
  assert.equal(recordingRequestExpired(at("10:00:00"), at("10:02:00")), true);
  assert.deepEqual(
    recordingExpiresAt(at("11:00:00"), 90),
    new Date("2027-03-01T11:00:00Z"),
  );
});

test("only the other participant may answer a request", () => {
  const party = { teacherId: "teacher", learnerId: "learner" };
  const recording = { requestedByUserId: "learner" };
  assert.equal(responderError(party, recording, "teacher"), null);
  assert.equal(
    responderError(party, recording, "learner"),
    "RECORDING_ACTION_NOT_ALLOWED",
  );
  assert.equal(
    responderError(party, recording, "stranger"),
    "SESSION_ACCESS_DENIED",
  );
  assert.equal(recordingObjectKey("s1", "r1"), "recordings/s1/r1.mp4");
});

test("recording storage is optional, needs shared storage and never echoes secrets", () => {
  const storage = {
    STORAGE_ENABLED: "true",
    STORAGE_ENDPOINT: "https://objects.example.invalid",
    STORAGE_REGION: "region-1",
    S3_BUCKET: "skillhub",
  };
  const keys = {
    RECORDING_STORAGE_ACCESS_KEY_ID: "upload-id",
    RECORDING_STORAGE_SECRET_ACCESS_KEY: "private-value",
  };
  assert.deepEqual(recordingStorageConfiguration(storage), { enabled: false });
  assert.deepEqual(recordingStorageConfiguration({ ...storage, ...keys }), {
    enabled: true,
    endpoint: "https://objects.example.invalid",
    region: "region-1",
    bucket: "skillhub",
    accessKeyId: "upload-id",
    secretAccessKey: "private-value",
  });
  // ConfigService hands over the validated boolean, not the raw string.
  assert.equal(
    recordingStorageConfiguration({
      ...storage,
      ...keys,
      STORAGE_ENABLED: true,
    }).enabled,
    true,
  );
  for (const input of [
    { ...storage, RECORDING_STORAGE_SECRET_ACCESS_KEY: "private-value" },
    { ...storage, ...keys, STORAGE_ENABLED: "false" },
    { ...storage, ...keys, STORAGE_ENABLED: false },
    { ...storage, ...keys, S3_BUCKET: "" },
  ])
    assert.throws(
      () => recordingStorageConfiguration(input),
      (error) =>
        error.message.startsWith("Invalid recording storage configuration:") &&
        !error.message.includes("private-value"),
    );
});
