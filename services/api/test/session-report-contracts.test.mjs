import "reflect-metadata";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { Test } from "@nestjs/testing";
import { VersioningType } from "@nestjs/common";
import { ReportsService } from "../dist/modules/reports/application/services/reports.service.js";
import { ParticipantCasesReader } from "../dist/modules/reports/application/services/participant-cases.reader.js";
import { CaseMessagesService } from "../dist/modules/reports/application/services/case-messages.service.js";
import { ReportSupportService } from "../dist/modules/reports/application/services/report-support.service.js";
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
import { MaterialReportsService } from "../dist/modules/materials/application/services/material-reports.service.js";
import { MaterialReviewsService } from "../dist/modules/materials/application/services/material-reviews.service.js";
import {
  A,
  B,
  C,
  user,
  setup,
  finalizedOneWay,
  fakeOutboxConsumer,
} from "./learning-platform/fixtures.mjs";
import { createFakeDb, runner } from "./learning-platform/fake-db.mjs";

async function cases(moderation) {
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
    undefined,
    moderation,
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

test("report intake queues private quoted text just before cutoff and blocks settlement even during a provider outage", async () => {
  const ctx = setup({ wallets: { [B]: 10000n } });
  const { session, pathId } = await finalizedOneWay(ctx);
  ctx.db.rows("session")[0].status = "COMPLETED";
  ctx.clock.now = new Date(+session.endAt + 48 * 3600000 - 1);
  const reports = new ReportsService(
    runner(ctx.db),
    {},
    {},
    new AuditWriter(new AuditRepository()),
    {},
    {},
    ctx.configuration,
    undefined,
    {
      mode: () => "enforce",
      evaluate: async () => {
        throw new Error("Provider is offline");
      },
    },
  );
  const description =
    'The other person threatened me with the words "I will hurt you"';
  const input = { reasonCode: "OTHER", description, evidenceFileIds: [] };
  const caseResult = await reports.createSessionReport(
    user(A),
    session.id,
    input,
  );
  assert.equal(caseResult.blocksSettlement, true);
  assert.equal(ctx.db.rows("learningPath")[0].status, "DISPUTED");
  assert.equal(await reports.hasBlockingDispute(ctx.db, pathId), true);
  assert.equal(+ctx.db.rows("reportCase")[0].createdAt, +ctx.clock.now);
  assert.equal(ctx.db.rows("reportCase")[0].description, description);
  await assert.rejects(
    reports.createSessionReport(user(A), session.id, input),
    /ACTIVE_SESSION_REPORT_EXISTS/,
  );
  const jobs = ctx.db
    .rows("outboxEvent")
    .filter(({ type }) => type === "report.content.moderation");
  assert.deepEqual(
    jobs.map(({ payload }) => payload),
    [{ kind: "CASE_REPORT", sourceId: caseResult.id }],
  );
  assert.doesNotMatch(
    JSON.stringify(ctx.db.rows("outboxEvent")),
    /I will hurt you/,
  );
  assert.doesNotMatch(
    JSON.stringify(ctx.db.rows("auditLog")),
    /I will hurt you/,
  );
});

test("material and material review reports queue only references and preserve private audit text", async () => {
  const db = createFakeDb();
  db.$queryRaw = async () => [];
  const transactions = runner(db);
  const materialId = randomUUID();
  const reviewId = randomUUID();
  db.seed("material", { id: materialId, ownerId: B, status: "PUBLISHED" });
  db.seed("materialReview", {
    id: reviewId,
    materialId,
    authorId: B,
    status: "VISIBLE",
    deletedAt: null,
  });
  const actor = { ...user(A), permissions: ["material:access"] };
  const moderation = {
    mode: () => "enforce",
    evaluate: async () => assert.fail("Intake should not wait for moderation"),
  };
  const materials = new MaterialReportsService(transactions, moderation);
  const reviews = new MaterialReviewsService(
    transactions,
    {},
    {},
    new AuditWriter(new AuditRepository()),
    moderation,
  );
  const description = "Private evidence covering both report types";
  const input = { reasonCode: "OTHER", description };
  const material = await materials.report(actor, materialId, input);
  const review = await reviews.report(actor, reviewId, input);
  assert.equal(db.rows("reportCase")[0].description, description);
  assert.equal(db.rows("materialReviewReport")[0].description, description);
  assert.equal(db.rows("reportCase")[0].blocksSettlement, false);
  await assert.rejects(
    reviews.report(actor, reviewId, input),
    /MATERIAL_REVIEW_REPORT_EXISTS/,
  );
  const jobs = db
    .rows("outboxEvent")
    .filter(({ type }) => type === "report.content.moderation");
  assert.deepEqual(
    jobs.map(({ payload }) => payload),
    [
      { kind: "CASE_REPORT", sourceId: material.id },
      { kind: "MATERIAL_REVIEW_REPORT", sourceId: review.id },
    ],
  );
  const audit = db
    .rows("auditLog")
    .find(({ action }) => action === "MATERIAL_REVIEW_REPORT");
  assert.ok(audit);
  assert.doesNotMatch(JSON.stringify(audit), /Private evidence/);
});

test("report moderation retries a provider failure and then classifies once without changing case or settlement", async () => {
  const { ReportContentModerationProcessor } =
    await import("../dist/modules/reports/infrastructure/events/report-content-moderation.processor.js");
  const ctx = await cases();
  const description = 'Private report quoting "I will hurt you"';
  ctx.report().description = description;
  ctx.report().blocksSettlement = true;
  const digest = createHash("sha256").update(description).digest("hex");
  const sourceId = ctx.caseId;
  ctx.db.seed("reportContentModeration", {
    kind: "CASE_REPORT",
    sourceId,
    caseId: ctx.caseId,
    status: "PENDING",
    restricted: true,
    sourceVersion: "1",
    digest,
  });
  const job = { kind: "CASE_REPORT", sourceId };
  let calls = 0;
  const worker = new ReportContentModerationProcessor(
    runner(ctx.db),
    {},
    {
      mode: () => "enforce",
      evaluate: async (input) => {
        calls++;
        assert.equal(input.text, description);
        assert.equal(input.sourceVersion, "1");
        assert.equal(input.digest, digest);
        return calls === 1
          ? {
              ...input,
              outcome: "RETRY",
              reasonCodes: ["PROVIDER_UNAVAILABLE"],
              policyVersion: "v1",
            }
          : {
              ...input,
              outcome: "BLOCK",
              reasonCodes: ["violence"],
              policyVersion: "v1",
            };
      },
    },
  );
  await assert.rejects(worker.process(job), /REPORT_MODERATION_RETRY/);
  assert.equal(ctx.db.rows("reportContentModeration")[0].status, "RETRY");
  await worker.process(job);
  await worker.process(job);
  const assessment = ctx.db.rows("reportContentModeration")[0];
  assert.equal(assessment.status, "BLOCK");
  assert.deepEqual(assessment.reasonCodes, ["violence"]);
  assert.equal(calls, 2);
  assert.equal(ctx.report().status, "OPEN");
  assert.equal(ctx.report().blocksSettlement, true);
  assert.doesNotMatch(JSON.stringify(assessment), /I will hurt you/);
});

test("admin work-item detail redacts restricted report narratives", async () => {
  const { AdminReportSourceReader } =
    await import("../dist/modules/reports/application/services/admin-report-source.reader.js");
  const reader = new AdminReportSourceReader();
  const row = { description: "private narrative", status: "OPEN" };
  let restricted = true;
  const tx = {
    reportCase: {
      findUnique: async ({ select }) => {
        assert.deepEqual(select.contentModeration.where, {
          kind: "CASE_REPORT",
          restricted: true,
        });
        return {
          ...row,
          contentModeration: restricted ? [{ sourceId: "case" }] : [],
        };
      },
    },
  };
  assert.equal((await reader.caseDetail(tx, "case")).description, "");
  restricted = false;
  assert.equal(
    (await reader.caseDetail(tx, "case")).description,
    row.description,
  );
});

test("Staff can filter flagged cases but only the assigned handler sees private assessment details", async () => {
  const ctx = await cases({ mode: () => "enforce" });
  const description = "Sensitive report content for the assigned handler";
  ctx.report().description = description;
  ctx.db.seed("reportContentModeration", {
    kind: "CASE_REPORT",
    sourceId: ctx.caseId,
    caseId: ctx.caseId,
    status: "BLOCK",
    restricted: true,
    sourceVersion: "1",
    digest: createHash("sha256").update(description).digest("hex"),
    reasonCodes: ["violence"],
  });
  ctx.db.seed("reportCase", { id: randomUUID(), status: "OPEN" });
  const support = new ReportSupportService(
    runner(ctx.db),
    {
      require: async (_tx, actor) => ({
        roles: actor.roles,
        permissions: new Set(actor.permissions),
        blockedPermissions: new Set(),
      }),
    },
    ctx.reports,
    {},
  );
  const staff = {
    userId: C,
    roles: ["STAFF"],
    permissions: ["report:moderate"],
  };
  const filter = { limit: 10, contentReview: "REQUIRED" };
  const filtered = await support.queue(staff, filter);
  assert.deepEqual(
    filtered.data.map(({ id }) => id),
    [ctx.caseId],
  );
  assert.equal(filtered.data[0].contentReviewRequired, true);
  assert.doesNotMatch(
    JSON.stringify(filtered),
    /violence|Sensitive report content/,
  );
  await assert.rejects(
    support.queue(user(A), filter),
    /REPORT_STAFF_PERMISSION_REQUIRED/,
  );
  const unassigned = await ctx.reports.staffCaseDetail(staff, ctx.caseId);
  assert.equal(unassigned.contentRestricted, true);
  assert.equal(unassigned.contentAssessments, undefined);
  assert.notEqual(unassigned.description, description);
  ctx.report().handlerId = C;
  const assigned = await ctx.reports.staffCaseDetail(staff, ctx.caseId);
  assert.equal(assigned.description, description);
  assert.deepEqual(assigned.contentAssessments[0].reasonCodes, ["violence"]);
  assert.equal(
    (await ctx.reports.mineDetail(user(A), ctx.caseId)).contentAssessments,
    undefined,
  );
});

test("an evidence generation changed before moderation completes discards the old job", async () => {
  const { ReportContentModerationProcessor } =
    await import("../dist/modules/reports/infrastructure/events/report-content-moderation.processor.js");
  const ctx = await cases();
  const sourceId = ctx.own.id;
  ctx.db.seed("storedFile", {
    id: ctx.own.storedFileId,
    purpose: "REPORT",
    resourceType: "REPORT_EVIDENCE",
    resourceId: ctx.caseId,
    state: "READY",
    scanVerdict: "CLEAN",
    generation: 1,
    sha256: "b".repeat(64),
  });
  ctx.db.seed("reportContentModeration", {
    kind: "CASE_EVIDENCE",
    sourceId,
    caseId: ctx.caseId,
    status: "PENDING",
    restricted: false,
    sourceVersion: `${ctx.own.storedFileId}:1`,
    digest: "b".repeat(64),
  });
  const job = { kind: "CASE_EVIDENCE", sourceId };
  let reads = 0;
  const worker = new ReportContentModerationProcessor(
    {
      run: async (work) => {
        if (++reads === 2) {
          ctx.db.rows("storedFile")[0].generation = 2;
          ctx.db.rows("storedFile")[0].sha256 = "c".repeat(64);
        }
        return runner(ctx.db).run(work);
      },
    },
    {},
    { evaluate: async () => assert.fail("Private evidence stays in the case") },
  );
  await worker.process(job);
  assert.equal(ctx.db.rows("reportContentModeration")[0].status, "SUPERSEDED");
  assert.equal(ctx.db.rows("storedFile")[0].generation, 2);
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
