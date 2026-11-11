import assert from "node:assert/strict";
import { test } from "node:test";
import { selectSessionReport } from "../src/features/reports/utils/session-report";
import { formatReportDeadline } from "../src/features/sessions/utils/session-time";

const sessionId = "20000000-0000-4000-8000-000000000001";
const row = (
  id: string,
  status: "OPEN" | "RESOLVED" = "OPEN",
  createdAt: string | null = "2030-01-01T00:00:00Z",
) => ({
  id,
  status,
  createdAt,
  targetType: "SESSION" as const,
  targetId: sessionId,
  relatedSessionId: sessionId as string | null,
});
test("session report entry prioritizes the caller's active report and otherwise the most recent closed report", () => {
  const active = row("active");
  const recentClosed = row("recent", "RESOLVED", "2030-01-03T00:00:00Z");
  const olderClosed = row("older", "RESOLVED", "2029-12-31T00:00:00Z");
  const rows = [recentClosed, active, olderClosed];
  assert.equal(selectSessionReport(rows, sessionId), active);
  assert.deepEqual(rows, [recentClosed, active, olderClosed]);
  assert.equal(
    selectSessionReport([olderClosed, recentClosed], sessionId),
    recentClosed,
  );
  assert.equal(
    selectSessionReport(
      [row("unknown-date", "RESOLVED", null), recentClosed],
      sessionId,
    ),
    recentClosed,
  );
});
test("report lookup never selects an unrelated session or Material report; legacy targetId remains supported", () => {
  const unrelated = {
    ...row("other"),
    relatedSessionId: "different",
    targetId: "different",
  };
  const material = { ...row("material"), targetType: "MATERIAL" as const };
  assert.equal(
    selectSessionReport([unrelated, material], sessionId),
    undefined,
  );
  const legacy = { ...row("legacy"), relatedSessionId: null };
  assert.equal(selectSessionReport([unrelated, legacy], sessionId), legacy);
  assert.equal(selectSessionReport([], sessionId), undefined);
});
test("compact report deadline shows the actual date and time in the selected timezone", () => {
  assert.equal(
    formatReportDeadline("2030-01-01T18:05:00Z", "Asia/Ho_Chi_Minh"),
    "01:05 · 02/01/2030",
  );
  assert.equal(
    formatReportDeadline("2030-01-01T18:05:00Z", "UTC"),
    "18:05 · 01/01/2030",
  );
});
