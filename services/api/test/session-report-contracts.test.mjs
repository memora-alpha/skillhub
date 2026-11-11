import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Test } from "@nestjs/testing";
import { VersioningType } from "@nestjs/common";
import { ReportsService } from "../dist/modules/reports/application/services/reports.service.js";
import { ParticipantCasesReader } from "../dist/modules/reports/application/services/participant-cases.reader.js";
import { CaseMessagesService } from "../dist/modules/reports/application/services/case-messages.service.js";
import { CaseMessageNotificationHandler } from "../dist/modules/notifications/infrastructure/events/case-message-notification.handler.js";
import { NotificationDispatcher } from "../dist/modules/notifications/application/services/notification-dispatcher.js";
import { PrismaInAppNotificationAdapter } from "../dist/modules/notifications/infrastructure/channels/prisma-in-app-notification.adapter.js";
import { PathOverviewController } from "../dist/modules/learning-paths/presentation/http/path-overview.controller.js";
import { PathOverviewReader } from "../dist/modules/learning-paths/application/services/path-overview.reader.js";
import { ReportsController } from "../dist/modules/reports/presentation/http/reports.controller.js";
import { IdentityGuard } from "../dist/shared/auth/identity.guard.js";
import { HttpExceptionFilter } from "../dist/shared/http/http-exception.filter.js";
import { AuditWriter } from "../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../dist/modules/audit/infrastructure/persistence/audit.repository.js";
import {
  A,
  B,
  C,
  user,
  setup,
  finalizedOneWay,
  fakeOutboxConsumer,
} from "./learning-platform/fixtures.mjs";
import { runner } from "./learning-platform/fake-db.mjs";

async function cases() {
  const ctx = setup({ wallets: { [B]: 10000n } });
  const { pathId, session } = await finalizedOneWay(ctx);
  const caseId = randomUUID();
  ctx.db.seed("reportCase", {
    id: caseId,
    reporterId: A,
    relatedPathId: pathId,
    relatedSessionId: session.id,
    targetType: "SESSION",
    targetId: session.id,
    reasonCode: "OTHER",
    status: "OPEN",
    handlerId: null,
    version: 1,
  });
  const evidence = (partyId, file, key) =>
    ctx.db.seed("reportEvidence", {
      id: randomUUID(),
      caseId,
      partyId,
      storedFileId: file,
      storageKey: key,
      mimeType: "image/png",
      fileSizeBytes: 123n,
      uploadedAt: ctx.clock.now,
    });
  const legacy = evidence(null, null, "legacy-private");
  const own = evidence(A, randomUUID(), "own-private");
  const partner = evidence(B, randomUUID(), "partner-private");
  const reports = new ReportsService(
    runner(ctx.db),
    {},
    {},
    new AuditWriter(new AuditRepository()),
    {},
    {},
    ctx.configuration,
  );
  const report = () => ctx.db.rows("reportCase").find((r) => r.id === caseId);
  ctx.db.$queryRawUnsafe = async () => [];
  const threads = new CaseMessagesService(
    runner(ctx.db),
    {
      require: async (_tx, actor) => ({
        ...actor,
        roles: actor.userId === C ? ["STAFF"] : ["USER"],
        permissions: new Set(["report:moderate", "report:communicate"]),
        blockedPermissions: new Set(),
      }),
    },
    {
      parties: async () => ({ item: report(), parties: [A, B] }),
      auditEvidenceRead: async () => {},
    },
    { stage: async () => {} },
    {
      attachReady: async (_tx, _actor, id) => ({
        mime: "image/png",
        key: id,
        size: 12,
        uploadedAt: ctx.clock.now,
      }),
    },
    { issueDownload: async (input) => ({ fileId: input.fileId }) },
  );
  return {
    ...ctx,
    pathId,
    session,
    caseId,
    reports,
    report,
    threads,
    legacy,
    own,
    partner,
  };
}

test("mine list/detail include current and legacy own evidence; partner metadata is private, Staff sees the full case", async () => {
  const ctx = await cases();
  for (const result of [
    (await ctx.reports.listMine(user(A)))[0],
    await ctx.reports.mineDetail(user(A), ctx.caseId),
  ]) {
    assert.equal(result.evidenceCount, 2);
    assert.deepEqual(
      result.reportEvidenceCaseIdRecords
        .map((e) => e.id)
        .sort((a, b) => a.localeCompare(b)),
      [ctx.legacy.id, ctx.own.id].sort((a, b) => a.localeCompare(b)),
    );
    assert.equal(result.reportEvidenceCaseIdRecords[1].fileSizeBytes, "123");
    assert.doesNotMatch(
      JSON.stringify(result),
      /partner-private|own-private|legacy-private|storageKey/,
    );
  }
  assert.deepEqual(await ctx.reports.listMine(user(B)), []);
  await assert.rejects(
    ctx.reports.mineDetail(user(B), ctx.caseId),
    /REPORT_CASE_NOT_FOUND/,
  );
  const queue = await ctx.reports.staffQueue({
    userId: C,
    roles: ["STAFF"],
    permissions: ["report:moderate"],
  });
  assert.equal(queue[0].evidenceCount, 3);
  assert.ok(
    queue[0].reportEvidenceCaseIdRecords.some(
      (e) => e.storedFileId === ctx.partner.storedFileId,
    ),
  );
});

test("private evidence endpoints retain ownership for legacy files and reject cross-party access", async () => {
  const ctx = await cases();
  const own = await ctx.threads.evidence(user(A), ctx.caseId, A);
  assert.equal(own.length, 2);
  const partner = await ctx.threads.evidence(user(B), ctx.caseId, B);
  assert.deepEqual(
    partner.map((e) => e.id),
    [ctx.partner.id],
  );
  await assert.rejects(
    ctx.threads.evidence(user(A), ctx.caseId, B),
    /CASE_THREAD_ACCESS_DENIED/,
  );
  await assert.rejects(
    ctx.threads.downloadEvidence(user(B), ctx.caseId, B, ctx.legacy.id),
    /REPORT_EVIDENCE_NOT_FOUND/,
  );
  const fileId = randomUUID();
  ctx.db.seed("storedFile", {
    id: fileId,
    objectKey: "legacy-private",
    purpose: "REPORT",
    resourceType: "REPORT_EVIDENCE",
    resourceId: ctx.caseId,
  });
  assert.equal(
    (await ctx.threads.downloadEvidence(user(A), ctx.caseId, A, ctx.legacy.id))
      .fileId,
    fileId,
  );
});

test("summary capabilities match new message/evidence POSTs, including handlerless, full, closed and restricted cases", async () => {
  const ctx = await cases();
  const reader = new ParticipantCasesReader();
  const summary = async (actor = A) =>
    (await reader.batch(ctx.db, actor, [ctx.pathId], ctx.clock.now))[0];
  const first = await summary();
  assert.equal(first.hasHandler, false);
  assert.equal(first.canSendMessage, false);
  assert.equal(first.messageBlockedReason, "CASE_HANDLER_REQUIRED");
  assert.equal(first.canAttachEvidence, true);
  assert.equal(first.ownEvidenceCount, 2);
  assert.equal("handlerId" in first, false);
  assert.equal("reporterId" in first, false);
  assert.equal((await summary(B)).ownEvidenceCount, 1);
  assert.deepEqual(
    await reader.batch(ctx.db, C, [ctx.pathId], ctx.clock.now),
    [],
  );
  await assert.rejects(
    ctx.threads.send(user(A), ctx.caseId, A, {
      clientMessageId: randomUUID(),
      text: "more details",
    }),
    /CASE_HANDLER_REQUIRED/,
  );
  await ctx.threads.attachEvidence(user(A), ctx.caseId, A, randomUUID());
  assert.equal((await summary()).ownEvidenceCount, 3);
  ctx.report().handlerId = C;
  assert.equal((await summary()).canSendMessage, true);
  const command = { clientMessageId: randomUUID(), text: "additional details" };
  await ctx.threads.send(user(A), ctx.caseId, A, command);
  for (let i = 0; i < 2; i++)
    await ctx.threads.attachEvidence(user(A), ctx.caseId, A, randomUUID());
  assert.equal((await summary()).evidenceBlockedReason, "CASE_EVIDENCE_LIMIT");
  await assert.rejects(
    ctx.threads.attachEvidence(user(A), ctx.caseId, A, randomUUID()),
    /CASE_EVIDENCE_LIMIT/,
  );
  ctx.report().status = "RESOLVED";
  const closed = await summary();
  assert.equal(closed.messageBlockedReason, "REPORT_CASE_CLOSED");
  assert.equal(closed.evidenceBlockedReason, "REPORT_CASE_CLOSED");
  await assert.rejects(
    ctx.threads.send(user(A), ctx.caseId, A, {
      ...command,
      clientMessageId: randomUUID(),
    }),
    /REPORT_CASE_CLOSED/,
  );
  ctx.report().status = "OPEN";
  ctx.db.seed("userRestriction", {
    id: randomUUID(),
    userId: A,
    scope: "ALL",
    startsAt: new Date(+ctx.clock.now - 1000),
    endsAt: new Date(+ctx.clock.now + 1000),
    revokedAt: null,
  });
  assert.equal(
    (await summary()).messageBlockedReason,
    "SKILL_PERMISSION_REQUIRED",
  );
  assert.equal(
    (await summary()).evidenceBlockedReason,
    "SKILL_PERMISSION_REQUIRED",
  );
});

test("ordinary Session detail/list expose the same report deadline and eligibility enforced by POST", async () => {
  const ctx = setup({ wallets: { [B]: 10000n } });
  const { session } = await finalizedOneWay(ctx);
  const row = ctx.db.rows("session")[0];
  row.status = "COMPLETED";
  ctx.clock.now = new Date(+session.endAt + 3600000);
  const detail = await ctx.sessions.detail(user(A), session.id);
  const deadline = new Date(+session.endAt + 48 * 3600000);
  assert.equal(+detail.deadlines.reportBy, +deadline);
  assert.equal(detail.deadlines.excuseOrReportBy, null);
  assert.equal(detail.reporting.canReport, true);
  assert.equal(+detail.reporting.evaluatedAt, +ctx.clock.now);
  const listed = (
    await ctx.sessions.mine(
      user(A),
      "2026-11-01T00:00:00Z",
      "2026-11-04T00:00:00Z",
    )
  ).data[0];
  assert.deepEqual(listed.reporting, detail.reporting);
  await ctx.sessions.reports.createSessionReport(user(A), session.id, {
    reasonCode: "OTHER",
    description: "A session issue",
    evidenceFileIds: [],
  });
  assert.equal(
    (await ctx.sessions.detail(user(A), session.id)).reporting.blockedReason,
    "ACTIVE_SESSION_REPORT_EXISTS",
  );
  assert.equal(
    (await ctx.sessions.detail(user(B), session.id)).reporting.canReport,
    true,
  );
  ctx.clock.now = deadline;
  assert.equal(
    (await ctx.sessions.detail(user(B), session.id)).reporting.blockedReason,
    "DISPUTE_WINDOW_CLOSED",
  );
  await assert.rejects(
    ctx.sessions.reports.createSessionReport(user(B), session.id, {
      reasonCode: "OTHER",
      description: "An issue",
      evidenceFileIds: [],
    }),
    /DISPUTE_WINDOW_CLOSED/,
  );
  await assert.rejects(
    ctx.sessions.detail(user(C), session.id),
    /SESSION_ACCESS_DENIED/,
  );
});

test("report preflight uses current occurrence outcome/policy and preserves cancelled/duplicate precedence", async () => {
  const ctx = setup({ wallets: { [B]: 10000n } });
  const { session } = await finalizedOneWay(ctx);
  const reports = ctx.sessions.reports;
  const read = async () =>
    (
      await reports.reportingForSessions(ctx.db, A, [ctx.db.rows("session")[0]])
    ).get(session.id);
  ctx.configuration.values["session.attendancePolicy"] = {
    disputeWindowHours: 12,
  };
  assert.equal(+(await read()).reportBy, +session.endAt + 12 * 3600000);
  const target = new Date(+session.endAt + 6 * 3600000);
  ctx.db.seed("sessionAttendanceOutcome", {
    sessionId: session.id,
    occurrenceStartAt: session.startAt,
    finalizesAt: target,
  });
  assert.equal(+(await read()).reportBy, +target);
  ctx.db.rows("sessionAttendanceOutcome")[0].occurrenceStartAt = new Date(
    +session.startAt - 86400000,
  );
  assert.equal(+(await read()).reportBy, +session.endAt + 12 * 3600000);
  ctx.configuration.values["session.attendancePolicy"] = undefined;
  assert.equal((await read()).blockedReason, "REPORT_POLICY_UNAVAILABLE");
  assert.equal((await read()).reportBy, null);
  ctx.db.rows("session")[0].status = "CANCELLED";
  assert.equal((await read()).blockedReason, "SESSION_NOT_REPORTABLE");
  await assert.rejects(
    reports.createSessionReport(user(A), session.id, {
      reasonCode: "OTHER",
      description: "Cancelled",
      evidenceFileIds: [],
    }),
    /SESSION_NOT_REPORTABLE/,
  );
});

test("support notifications carry canonical system/partner case context and remain private/idempotent", async () => {
  const ctx = await cases();
  ctx.report().reporterId = null;
  ctx.report().handlerId = C;
  const registry = new Map();
  const dispatcher = new NotificationDispatcher(
    fakeOutboxConsumer(ctx.db),
    new PrismaInAppNotificationAdapter(),
    {},
    {},
    new Set(["IN_APP"]),
  );
  const handler = new CaseMessageNotificationHandler(
    { register: (type, publisher) => registry.set(type, publisher) },
    runner(ctx.db),
    {
      byId: async () => ({ accountStatus: "ACTIVE" }),
      grants: async () => ({
        roles: ["STAFF"],
        permissions: ["report:communicate", "report:moderate"],
      }),
    },
    dispatcher,
  );
  handler.onModuleInit();
  assert.equal(registry.get("report.case.evidence"), handler);
  const messageId = "a".repeat(64);
  ctx.db.seed("reportMessageReceipt", {
    messageId,
    caseId: ctx.caseId,
    partyId: B,
    senderId: C,
  });
  const event = {
    eventId: randomUUID(),
    type: "report.case.message",
    version: 1,
    correlationId: randomUUID(),
    payload: { caseId: ctx.caseId, partyId: B, senderId: C, messageId },
  };
  await handler.publish(event);
  await handler.publish(event);
  const notice = ctx.db.rows("notification")[0];
  assert.equal(ctx.db.rows("notification").length, 1);
  assert.equal(notice.userId, B);
  assert.equal(notice.payload.relatedPathId, ctx.pathId);
  assert.equal(notice.payload.pathId, ctx.pathId);
  assert.equal(notice.payload.relatedSessionId, ctx.session.id);
  assert.equal(notice.payload.messageId, messageId);
  await handler.publish({
    ...event,
    eventId: randomUUID(),
    type: "report.case.evidence",
    payload: {
      caseId: ctx.caseId,
      partyId: A,
      senderId: A,
      evidenceId: ctx.own.id,
    },
  });
  assert.equal(ctx.db.rows("notification")[1].userId, C);
  assert.equal(
    ctx.db.rows("notification")[1].payload.relatedPathId,
    ctx.pathId,
  );
  assert.doesNotMatch(
    JSON.stringify(ctx.db.rows("notification")),
    /storageKey|private/,
  );
  await assert.rejects(
    handler.publish({
      ...event,
      eventId: randomUUID(),
      payload: { ...event.payload, partyId: A },
    }),
    /INVALID_CASE_MESSAGE_RECEIPT/,
  );
});

test("HTTP report detail and participant summary expose only caller-scoped evidence and independent capabilities", async () => {
  const ctx = await cases();
  const reader = new ParticipantCasesReader();
  const module = await Test.createTestingModule({
    controllers: [ReportsController, PathOverviewController],
    providers: [
      { provide: ReportsService, useValue: ctx.reports },
      {
        provide: PathOverviewReader,
        useValue: {
          read: async (actor) => ({
            cases: await reader.batch(
              ctx.db,
              actor.userId,
              [ctx.pathId],
              ctx.clock.now,
            ),
            attentionItems: [],
          }),
        },
      },
    ],
  })
    .overrideGuard(IdentityGuard)
    .useValue({
      canActivate: (context) => {
        context.switchToHttp().getRequest().principal = user(A);
        return true;
      },
    })
    .compile();
  const app = module.createNestApplication({ logger: false });
  try {
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const evidence = await fetch(`${base}/api/v1/reports/mine/${ctx.caseId}`);
    assert.equal(evidence.status, 200);
    assert.equal((await evidence.json()).data.evidenceCount, 2);
    const summary = await fetch(
      `${base}/api/v1/learning-paths/${ctx.pathId}/cases/${ctx.caseId}/summary`,
    );
    assert.equal(summary.status, 200);
    const body = await summary.json();
    assert.equal(body.data.canSendMessage, false);
    assert.equal(body.data.canAttachEvidence, true);
    assert.equal(body.data.ownEvidenceCount, 2);
  } finally {
    await app.close();
  }
});
