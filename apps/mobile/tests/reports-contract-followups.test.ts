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
  casePermissions,
  caseAwaitingHandler,
} from "../src/features/reports/utils/case-actions";
import { notificationTarget } from "../src/features/notifications/utils/notification-target";
import type { InboxNotification } from "../src/features/notifications/api/notifications-api";
import { caseCapabilities } from "../src/lib/http/case-capabilities";

const actor = "10000000-0000-4000-8000-000000000001";
const caseId = "a0000000-0000-4000-8000-000000000001";
const sessionId = "20000000-0000-4000-8000-000000000001";
const pathId = "30000000-0000-4000-8000-000000000001";

test("handler waiting follows server context and only uses missing-handler fallback on open cases without a path", () => {
  const context = {
    status: "OPEN",
    hasPath: false,
    handlerId: null,
    waiting: false,
  };
  assert.equal(caseAwaitingHandler(context), true);
  assert.equal(caseAwaitingHandler({ ...context, hasPath: true }), false);
  assert.equal(
    caseAwaitingHandler({ ...context, handlerId: undefined }),
    false,
  );
  assert.equal(caseAwaitingHandler({ ...context, status: "RESOLVED" }), false);
  assert.equal(
    caseAwaitingHandler({ ...context, hasPath: true, waiting: true }),
    true,
  );
  assert.equal(
    caseAwaitingHandler({
      ...context,
      hasPath: true,
      reason: "CASE_HANDLER_REQUIRED",
    }),
    true,
  );
});

test("schedule confirmation notifications open the agreement schedule and never a payload URL", () => {
  const item: InboxNotification = {
    id: caseId,
    type: "learning-path.schedule.confirmed",
    title: "",
    body: "",
    readAt: null,
    createdAt: "2030-01-01T00:00:00Z",
    payload: { pathId, url: "https://example.test/evil" },
  };
  assert.deepEqual(notificationTarget(item), {
    pathname: "/paths/[id]/schedules",
    params: { id: pathId },
  });
  assert.equal(
    notificationTarget({ ...item, payload: { pathId: "bad" } }),
    undefined,
  );
});

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
  assert.equal(canSendCaseMessage("UNDER_REVIEW", undefined), false);
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
    assert.deepEqual(
      notificationTarget({
        ...item,
        payload: { caseId, relatedPathId: pathId, partyId: actor },
      }),
      {
        pathname: "/reports/[id]",
        params: { id: caseId, support: "1", pathId },
      },
    );
  }
});

test("evidence uses the viewer's private API even when legacy report metadata is empty", async () => {
  const file = {
    id: caseId,
    storedFileId: null,
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
    evidenceCount: 0,
    reportEvidenceCaseIdRecords: [],
  };
  const api = createReportsApi(async () => row, actor);
  assert.equal((await api.detail(caseId)).handlerId, null);
  row.reporterId = caseId;
  await assert.rejects(api.detail(caseId));
});

test("server capabilities override local handler/status and keep evidence independent", () => {
  const fallback = { status: "OPEN", handlerId: actor, evidenceCount: 0 };
  const unassigned = caseCapabilities.parse({
    hasHandler: false,
    ownEvidenceCount: 2,
    canSendMessage: false,
    messageBlockedReason: "CASE_HANDLER_REQUIRED",
    canAttachEvidence: true,
    evidenceBlockedReason: null,
  });
  assert.deepEqual(casePermissions(unassigned, fallback), {
    canSendMessage: false,
    canAttachEvidence: true,
  });
  const full = {
    ...unassigned,
    hasHandler: true,
    canSendMessage: true,
    messageBlockedReason: null,
    ownEvidenceCount: 5,
    canAttachEvidence: false,
    evidenceBlockedReason: "CASE_EVIDENCE_LIMIT",
  };
  assert.deepEqual(casePermissions(full, {}), {
    canSendMessage: true,
    canAttachEvidence: false,
  });
  const restricted = {
    ...full,
    canSendMessage: false,
    messageBlockedReason: "SKILL_PERMISSION_REQUIRED",
  };
  assert.deepEqual(casePermissions(restricted, fallback), {
    canSendMessage: false,
    canAttachEvidence: false,
  });
  assert.deepEqual(casePermissions(full, fallback, true), {
    canSendMessage: false,
    canAttachEvidence: false,
  });
  assert.deepEqual(casePermissions(undefined, {}), {
    canSendMessage: false,
    canAttachEvidence: false,
  });
  assert.equal(
    caseCapabilities.safeParse({ ...full, ownEvidenceCount: -1 }).success,
    false,
  );
});

test("owner and private evidence retain legacy/current metadata and server count", async () => {
  const legacy = {
    id: caseId,
    storedFileId: null,
    mimeType: "image/png",
    fileSizeBytes: "9007199254740993",
    uploadedAt: "2030-01-01T00:00:00Z",
  };
  const current = { ...legacy, id: sessionId, storedFileId: pathId };
  const row = {
    id: caseId,
    reporterId: actor,
    targetType: "SESSION",
    targetId: sessionId,
    relatedSessionId: sessionId,
    relatedPathId: pathId,
    reasonCode: "OTHER",
    description: "Mô tả báo cáo.",
    status: "OPEN",
    handlerId: null,
    resolutionNote: null,
    blocksSettlement: false,
    createdAt: null,
    evidenceCount: 2,
    reportEvidenceCaseIdRecords: [legacy, current],
  };
  const api = createReportsApi(
    async (path) => (path.includes("/support/") ? [legacy, current] : row),
    actor,
  );
  assert.equal((await api.detail(caseId)).evidenceCount, 2);
  assert.deepEqual((await api.detail(caseId)).reportEvidenceCaseIdRecords, [
    legacy,
    current,
  ]);
  assert.deepEqual(await api.evidence(caseId), [legacy, current]);
});
