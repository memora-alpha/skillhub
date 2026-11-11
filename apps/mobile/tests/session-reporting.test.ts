import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sessionReportingState,
  reportRefreshDelay,
} from "../src/features/sessions/utils/session-reporting";

const snapshot = {
  canReport: true,
  blockedReason: null,
  reportBy: "2030-01-01T12:00:00Z",
  evaluatedAt: "2030-01-01T11:00:00Z",
};
test("report precheck follows BE eligibility for expiration, cancellation and caller-specific duplicate", () => {
  assert.equal(sessionReportingState(snapshot).allowed, true);
  for (const blockedReason of [
    "DISPUTE_WINDOW_CLOSED",
    "ACTIVE_SESSION_REPORT_EXISTS",
    "SESSION_NOT_REPORTABLE",
    "SESSION_ACCESS_DENIED",
    "REPORT_POLICY_UNAVAILABLE",
  ]) {
    const state = sessionReportingState({
      ...snapshot,
      canReport: false,
      blockedReason,
    });
    assert.equal(state.allowed, false);
    assert.equal(state.reason, blockedReason);
    assert.ok(state.message.length > 0);
  }
  assert.match(
    sessionReportingState({
      ...snapshot,
      canReport: false,
      blockedReason: "DISPUTE_WINDOW_CLOSED",
    }).message,
    /hết hạn/,
  );
  assert.equal(sessionReportingState(undefined).allowed, false);
  assert.equal(
    sessionReportingState({ ...snapshot, reportBy: null }).allowed,
    false,
  );
  assert.equal(
    sessionReportingState({ ...snapshot, evaluatedAt: snapshot.reportBy })
      .allowed,
    false,
  );
  assert.equal(
    sessionReportingState({ ...snapshot, blockedReason: "UNKNOWN" }).allowed,
    false,
  );
});

test("deadline refresh uses server interval and elapsed cache age, without assuming the device clock matches BE", () => {
  assert.equal(reportRefreshDelay(snapshot), 3_600_000);
  assert.equal(reportRefreshDelay(snapshot, 1000), 3_599_000);
  assert.equal(reportRefreshDelay(snapshot, -1000), 3_600_000);
  assert.equal(reportRefreshDelay(snapshot, 3_600_001), 0);
  assert.equal(reportRefreshDelay({ ...snapshot, canReport: false }), null);
  assert.equal(reportRefreshDelay(undefined), null);
});

test("a previously allowed snapshot locks at its cutoff without waiting for another BE read", () => {
  assert.equal(sessionReportingState(snapshot, 3_599_999).allowed, true);
  const expired = sessionReportingState(snapshot, 3_600_000);
  assert.equal(expired.allowed, false);
  assert.equal(expired.reason, "DISPUTE_WINDOW_CLOSED");
  assert.match(expired.message, /hết hạn/);
  assert.equal(sessionReportingState(snapshot, 3_600_001).allowed, false);
  assert.equal(sessionReportingState(snapshot, -1000).allowed, true);
});
