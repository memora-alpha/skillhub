import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canJoinSession,
  sessionJoinReason,
  sessionRoomClosesAt,
} from "../src/features/sessions/utils/session-join";

const end = Date.parse("2030-01-01T12:00:00Z");
const session = {
  status: "AWAITING_CONFIRMATION" as const,
  startAt: "2030-01-01T11:00:00Z",
  endAt: "2030-01-01T12:00:00Z",
  allowedActions: ["JOIN" as const],
  join: {
    canJoin: true,
    opensAt: "2030-01-01T10:50:00Z",
    closesAt: "2030-01-01T12:10:00Z",
    reason: null,
  },
};
test("the server join window permits reconnection after lesson end and closes exactly at closesAt", () => {
  assert.equal(canJoinSession(session, end), true);
  assert.equal(canJoinSession(session, end + 5 * 60_000), true);
  assert.equal(canJoinSession(session, end + 10 * 60_000 - 1), true);
  assert.equal(
    sessionJoinReason(session, end + 10 * 60_000),
    "JOIN_WINDOW_CLOSED",
  );
  assert.equal(sessionRoomClosesAt(session), end + 10 * 60_000);
});
test("server denial and terminal states still block; the client does not invent a grace period", () => {
  assert.equal(
    canJoinSession(
      {
        ...session,
        join: {
          ...session.join,
          canJoin: false,
          reason: "SESSION_NOT_JOINABLE",
        },
      },
      end,
    ),
    false,
  );
  assert.equal(canJoinSession({ ...session, allowedActions: [] }, end), false);
  for (const status of [
    "COMPLETED",
    "CANCELLED",
    "DISPUTED",
    "NO_SHOW",
    "MAKEUP_REQUIRED",
  ] as const)
    assert.equal(canJoinSession({ ...session, status }, end), false);
  assert.equal(
    canJoinSession(
      { ...session, join: { ...session.join, closesAt: session.endAt } },
      end,
    ),
    false,
  );
  assert.equal(canJoinSession({ ...session, join: undefined }, end), false);
  assert.equal(sessionRoomClosesAt({ endAt: session.endAt }), end);
});
