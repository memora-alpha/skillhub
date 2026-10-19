import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sessionJoinWindow,
  sessionJoinAccess,
  sessionStatusAt,
} from "../../dist/modules/learning-sessions/session.policy.js";

const startAt = new Date("2026-11-02T03:00:00Z");
const endAt = new Date("2026-11-02T04:00:00Z");
const session = { startAt, endAt, status: "CONFIRMED" };
const policy = { earlyMinutes: 10, lateMinutes: 10 };

test("join window uses UTC with inclusive open and exclusive close", () => {
  const window = sessionJoinWindow(startAt, endAt, policy);
  assert.equal(window.opensAt.toISOString(), "2026-11-02T02:50:00.000Z");
  assert.equal(window.closesAt.toISOString(), "2026-11-02T04:10:00.000Z");
  assert.equal(
    sessionJoinAccess(session, new Date(+window.opensAt - 1), policy, true)
      .reason,
    "JOIN_WINDOW_NOT_OPEN",
  );
  assert.equal(
    sessionJoinAccess(session, window.opensAt, policy, true).canJoin,
    true,
  );
  assert.equal(
    sessionJoinAccess(session, window.closesAt, policy, true).reason,
    "JOIN_WINDOW_CLOSED",
  );
  assert.deepEqual(
    sessionJoinWindow(new Date("2026-11-02T10:00:00+07:00"), endAt, policy),
    window,
  );
});

test("missing policy is unavailable, never an unrestricted window", () => {
  assert.equal(
    sessionJoinAccess(session, startAt, null, true).reason,
    "LIVEKIT_POLICY_NOT_READY",
  );
  assert.equal(
    sessionJoinAccess(session, startAt, policy, false).reason,
    "LIVEKIT_DISABLED",
  );
  assert.equal(sessionStatusAt(session, startAt, null), "CONFIRMED");
  assert.equal(sessionStatusAt(session, endAt, null), "AWAITING_CONFIRMATION");
});

test("reconnect is allowed in ongoing and late grace, terminal states never join", () => {
  assert.equal(
    sessionJoinAccess({ ...session, status: "ONGOING" }, startAt, policy, true)
      .canJoin,
    true,
  );
  assert.equal(
    sessionJoinAccess(
      { ...session, status: "AWAITING_CONFIRMATION" },
      endAt,
      policy,
      true,
    ).canJoin,
    true,
  );
  for (const status of ["COMPLETED", "CANCELLED", "DISPUTED"]) {
    assert.equal(
      sessionJoinAccess({ ...session, status }, startAt, policy, true).reason,
      "SESSION_NOT_JOINABLE",
    );
    assert.equal(
      sessionStatusAt({ ...session, status }, endAt, policy),
      status,
    );
  }
  assert.equal(sessionStatusAt(session, startAt, policy), "READY");
  assert.equal(
    sessionStatusAt({ ...session, status: "ONGOING" }, endAt, policy),
    "AWAITING_CONFIRMATION",
  );
});

test("invalid dates, negative, fractional and overflowing windows are rejected", () => {
  for (const earlyMinutes of [-1, 0.5, Number.MAX_SAFE_INTEGER, NaN]) {
    assert.throws(() =>
      sessionJoinWindow(startAt, endAt, { ...policy, earlyMinutes }),
    );
  }
  assert.throws(() => sessionJoinWindow(new Date(NaN), endAt, policy));
  assert.throws(() => sessionJoinWindow(endAt, startAt, policy));
});

test("overflowing effective policy disables join without breaking read projections", () => {
  const overflow = { earlyMinutes: Number.MAX_SAFE_INTEGER, lateMinutes: 0 };
  assert.equal(sessionStatusAt(session, startAt, overflow), "CONFIRMED");
  assert.equal(
    sessionJoinAccess(session, startAt, overflow, true).reason,
    "LIVEKIT_POLICY_NOT_READY",
  );
});
