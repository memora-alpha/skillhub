import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createReportsApi,
  reportReasons,
  materialReportReasons,
} from "../src/features/reports/api/reports-api";
import {
  canSendCaseMessage,
  canWriteCase,
} from "../src/features/reports/utils/case-actions";
import { notificationTarget } from "../src/features/notifications/utils/notification-target";
import type { InboxNotification } from "../src/features/notifications/api/notifications-api";

const actor = "10000000-0000-4000-8000-000000000001";
const caseId = "a0000000-0000-4000-8000-000000000001";
const sessionId = "20000000-0000-4000-8000-000000000001";
const pathId = "30000000-0000-4000-8000-000000000001";

test("session no-show reports use the existing API and are excluded from Material reports", async () => {
  assert.ok(reportReasons.includes("NO_SHOW_LATE"));
  assert.equal(
    materialReportReasons.some((value) => String(value) === "NO_SHOW_LATE"),
    false,
  );
  const calls: { path: string; body: unknown }[] = [];
  const api = createReportsApi(async (path, options) => {
    calls.push({ path, body: options?.body });
    return { id: caseId, status: "OPEN" };
  }, actor);
  const input = {
    reasonCode: "NO_SHOW_LATE" as const,
    description: "Đối tác không tham gia buổi học đã hẹn.",
  };
  await api.submit("SESSION", sessionId, input);
  assert.equal(calls[0]?.path, `/reports/sessions/${sessionId}`);
  assert.deepEqual(calls[0]?.body, { ...input, evidenceFileIds: [] });
  await assert.rejects(api.submit("MATERIAL", sessionId, input));
  assert.equal(calls.length, 1);
});

test("unassigned cases allow evidence separately from messages; closed/unknown cases stay read-only", () => {
  assert.equal(canWriteCase("OPEN"), true);
  assert.equal(canSendCaseMessage("OPEN", null), false);
  assert.equal(canSendCaseMessage("OPEN", actor), true);
  assert.equal(canSendCaseMessage("NEED_MORE_INFO", actor, true), false);
  for (const status of [undefined, "RESOLVED", "REJECTED", "UNKNOWN"]) {
    assert.equal(canWriteCase(status), false);
    assert.equal(canSendCaseMessage(status, actor), false);
  }
  // Older/participant summaries without handler data defer the check to POST.
  assert.equal(canSendCaseMessage("UNDER_REVIEW", undefined), true);
});

test("all Report notifications open the current viewer's support route without trusting party/URL payloads", () => {
  for (const type of [
    "report.session.opened",
    "report.case.updated",
    "report.case.message",
    "report.case.evidence",
  ]) {
    const item: InboxNotification = {
      id: caseId,
      type,
      title: "",
      body: "",
      readAt: null,
      createdAt: "2030-01-01T00:00:00Z",
      payload: {
        caseId,
        pathId,
        partyId: "another-party",
        url: "https://example.test/untrusted",
      },
    };
    assert.deepEqual(notificationTarget(item), {
      pathname: "/reports/[id]",
      params: { id: caseId, support: "1", pathId },
    });
    assert.deepEqual(notificationTarget({ ...item, payload: { caseId } }), {
      pathname: "/reports/[id]",
      params: { id: caseId, support: "1" },
    });
    assert.equal(
      notificationTarget({ ...item, payload: { caseId: "invalid", pathId } }),
      undefined,
    );
  }
});

test("evidence uses the viewer's private API even when legacy report metadata is empty", async () => {
  const file = {
    id: caseId,
    mimeType: "image/png",
    fileSizeBytes: "123",
    uploadedAt: "2030-01-01T00:00:00Z",
  };
  let evidencePath = "";
  const api = createReportsApi(async (path) => {
    evidencePath = path;
    return [file];
  }, actor);
  assert.deepEqual(await api.evidence(caseId), [file]);
  assert.equal(
    evidencePath,
    `/reports/support/cases/${caseId}/parties/${actor}/evidence`,
  );
  await assert.rejects(api.evidence("invalid"));
});

test("owner report parsing retains handler status without accepting another reporter", async () => {
  const row = {
    id: caseId,
    reporterId: actor,
    targetType: "SESSION",
    targetId: sessionId,
    relatedSessionId: sessionId,
    relatedPathId: pathId,
    reasonCode: "NO_SHOW_LATE",
    description: "Đối tác không tham gia.",
    status: "OPEN",
    handlerId: null,
    resolutionNote: null,
    blocksSettlement: true,
    createdAt: null,
    reportEvidenceCaseIdRecords: [],
  };
  const api = createReportsApi(async () => row, actor);
  assert.equal((await api.detail(caseId)).handlerId, null);
  row.reporterId = caseId;
  await assert.rejects(api.detail(caseId));
});
