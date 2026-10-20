import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AuditWriter } from "../../dist/modules/audit/application/audit-writer.js";
import { AuditRepository } from "../../dist/modules/audit/infrastructure/audit.repository.js";
import { UnavailableCreditAdjustmentAdapter } from "../../dist/modules/credit/unavailable-credit-adjustment.adapter.js";
import { LearningPathNotificationHandler } from "../../dist/modules/notifications/application/learning-path-notification.handler.js";
import { NotificationDispatcher } from "../../dist/modules/notifications/application/notification-dispatcher.js";
import { PrismaInAppNotificationAdapter } from "../../dist/modules/notifications/infrastructure/channels/prisma-in-app-notification.adapter.js";
import { AchievementsService } from "../../dist/modules/reputation/achievements.service.js";
import { ReputationService } from "../../dist/modules/reputation/reputation.service.js";
import { seedAchievements } from "../../dist/modules/reputation/seed-achievements.js";
import {
  CreateSessionReportDto,
  ReportCaseActionDto,
} from "../../dist/modules/reports/reports.dto.js";
import { ReportsService } from "../../dist/modules/reports/reports.service.js";
import { CreateReviewDto } from "../../dist/modules/reviews/reviews.dto.js";
import { ReviewsService } from "../../dist/modules/reviews/reviews.service.js";
import { runner } from "./fake-db.mjs";
import {
  A,
  B,
  C,
  completedOneWay,
  fakeOutboxConsumer,
  pathRow,
  pathStatus,
  httpError,
  rejectsWith,
  settledOneWay,
  setup,
  user,
} from "./fixtures.mjs";

const staff = {
  userId: "5a5a5a5a-0000-4000-8000-0000000000aa",
  roles: ["STAFF"],
  permissions: ["report:moderate"],
};
const admin = {
  userId: "adadadad-0000-4000-8000-0000000000ad",
  roles: ["ADMIN"],
  permissions: [
    "report:moderate",
    "credit:adjust",
    "credit:reverse:settlement",
    "dispute:override",
  ],
};

function recordingAdjustments() {
  const calls = [];
  const record = (kind) => async (_tx, input) => {
    calls.push([kind, input]);
    return { operationId: randomUUID() };
  };
  return { calls, adjust: record("adjust"), reverse: record("reverse") };
}

function phase3(options = {}) {
  const ctx = setup({ wallets: { [A]: 0n, [B]: 10000n } });
  const audit = new AuditWriter(new AuditRepository());
  const reputation = new ReputationService(audit);
  const achievements = new AchievementsService(runner(ctx.db));
  const adjustments = options.adjustments ?? recordingAdjustments();
  const reports = new ReportsService(
    runner(ctx.db),
    {},
    {},
    audit,
    reputation,
    adjustments,
  );
  const reviews = new ReviewsService(runner(ctx.db), reputation, achievements);
  return { ...ctx, reputation, achievements, adjustments, reports, reviews };
}

const score = (db, userId) =>
  db.rows("user").find((row) => row.id === userId).reputationScore;

const audits = (db, action) =>
  db.rows("auditLog").filter((row) => row.action === action);

/** Some guards throw before the transaction starts; surface them as rejections. */
const later = (work) => (async () => work())();

const invalid = async (Dto, plain) =>
  (await validate(plainToInstance(Dto, plain))).length > 0;

async function openReport(ctx) {
  const ids = await completedOneWay(ctx);
  const report = await ctx.reports.createSessionReport(
    user(B),
    ids.session.id,
    {
      reasonCode: "NO_SHOW_LATE",
      description: "The teacher joined forty minutes late.",
      evidenceFileIds: [],
    },
  );
  return { ...ids, caseId: report.id };
}

test("SH-080: reviews open after COMPLETED, once per reviewer, with 1-5 stars", async () => {
  const early = phase3();
  const active = await completedOneWay(early);
  await rejectsWith(
    early.reviews.create(user(B), active.pathId, { rating: 5 }),
    409,
    "REVIEW_NOT_OPEN",
  );

  const ctx = phase3();
  const { pathId } = await settledOneWay(ctx);
  await rejectsWith(
    ctx.reviews.create(user(C), pathId, { rating: 5 }),
    403,
    "LEARNING_PATH_ACCESS_DENIED",
  );
  await ctx.reviews.create(user(B), pathId, { rating: 5 });
  await rejectsWith(
    ctx.reviews.create(user(B), pathId, { rating: 4 }),
    409,
    "REVIEW_ALREADY_SUBMITTED",
  );
  assert.equal(score(ctx.db, A), 52);
  for (const rating of [0, 6, 2.5]) {
    assert.ok(await invalid(CreateReviewDto, { rating }), `rating ${rating}`);
  }
  for (const rating of [1, 5]) {
    assert.equal(await invalid(CreateReviewDto, { rating }), false);
  }
});

test("SH-081: reputation starts at 50, stays within 0-100 and every change is traceable", async () => {
  const ctx = phase3();
  const tx = ctx.db;
  const apply = (delta, eventKey) =>
    ctx.reputation.apply(tx, {
      userId: A,
      delta,
      reasonCode: "TEST",
      sourceType: "TEST",
      sourceId: eventKey,
      eventKey,
      now: ctx.clock.now,
    });
  assert.equal(score(ctx.db, A), 50);

  await apply(-100, "down");
  await apply(200, "up");
  await apply(200, "up");

  assert.equal(score(ctx.db, A), 100);
  assert.deepEqual(
    ctx.db
      .rows("reputationHistory")
      .map(({ scoreBefore, scoreAfter, delta, reasonCode, sourceType }) => [
        scoreBefore,
        scoreAfter,
        delta,
        reasonCode,
        sourceType,
      ]),
    [
      [50, 0, -50, "TEST", "TEST"],
      [0, 100, 100, "TEST", "TEST"],
    ],
  );

  const noShow = { userId: B, sessionId: "session-1", now: ctx.clock.now };
  await ctx.reputation.applyNoShow(tx, noShow);
  await ctx.reputation.applyNoShow(tx, noShow);
  assert.equal(score(ctx.db, B), 42);

  for (let index = 0; index < 11; index += 1) {
    await ctx.reputation.applyPathCompletion(
      tx,
      C,
      `path-${index}`,
      ctx.clock.now,
    );
  }
  assert.equal(score(ctx.db, C), 60);
});

test("SH-082: reputation bands give a warning first, then timed locks with review scopes", async () => {
  const ctx = phase3();
  const history = () => ctx.reviews.history(user(A));
  let step = 0;
  const moveBy = (delta) =>
    ctx.reputation.apply(ctx.db, {
      userId: A,
      delta,
      reasonCode: "TEST",
      sourceType: "TEST",
      sourceId: "test",
      eventKey: `step-${(step += 1)}`,
      now: ctx.clock.now,
    });

  await moveBy(-5);
  let state = await history();
  assert.deepEqual([state.level, state.activeRestrictions], ["WARNING", []]);

  await moveBy(-10);
  state = await history();
  assert.equal(state.level, "RESTRICTED");
  assert.deepEqual(
    state.activeRestrictions.map(({ scope, endsAt }) => [
      scope,
      endsAt.toISOString(),
    ]),
    [["CREATE_NEW_ACTIVITY", "2026-10-21T00:00:00.000Z"]],
  );

  await moveBy(-20);
  state = await history();
  assert.equal(state.level, "SEVERE");
  assert.ok(
    state.activeRestrictions.some(
      ({ scope }) => scope === "REQUIRE_STAFF_REVIEW",
    ),
  );

  await moveBy(-10);
  state = await history();
  assert.equal(state.level, "CRITICAL");
  assert.ok(
    state.activeRestrictions.some(
      ({ scope }) => scope === "REQUIRE_ADMIN_REVIEW",
    ),
  );
  assert.ok(
    audits(ctx.db, "USER_RESTRICTION_APPLY").every(({ reason }) =>
      /Reputation score \d+ requires/.test(reason),
    ),
  );
});

test("SH-083: badges unlock on their criteria and only unlocked titles can be shown", async () => {
  const ctx = phase3();
  await seedAchievements(ctx.db);
  await settledOneWay(ctx);

  await rejectsWith(
    ctx.achievements.selectTitle(user(B), "FIVE_PATHS"),
    409,
    "TITLE_NOT_UNLOCKED",
  );
  const chosen = await ctx.achievements.selectTitle(user(B), "FIRST_PATH");

  const firstPath = ctx.db
    .rows("achievement")
    .find((a) => a.code === "FIRST_PATH");
  assert.equal(chosen.selectedTitle, firstPath.title);
  assert.equal(
    ctx.db.rows("user").find((row) => row.id === B).selectedTitle,
    firstPath.title,
  );
});

test("SH-090: reports use the SRS reason codes, need a description and cap evidence", async () => {
  const valid = {
    reasonCode: "OTHER",
    description: "Something else went wrong.",
  };
  assert.equal(await invalid(CreateSessionReportDto, valid), false);
  assert.ok(
    await invalid(CreateSessionReportDto, { ...valid, reasonCode: "NO_SHOW" }),
  );
  assert.ok(
    await invalid(CreateSessionReportDto, {
      reasonCode: "OTHER",
      description: "",
    }),
  );
  assert.ok(
    await invalid(CreateSessionReportDto, {
      ...valid,
      evidenceFileIds: Array.from({ length: 6 }, () => randomUUID()),
    }),
  );
});

test("SH-090: a session report comes from a participant inside the dispute window", async () => {
  const ctx = phase3();
  const ids = await completedOneWay(ctx);
  const input = {
    reasonCode: "NO_SHOW_LATE",
    description: "The teacher joined forty minutes late.",
    evidenceFileIds: [],
  };
  await rejectsWith(
    ctx.reports.createSessionReport(user(C), ids.session.id, input),
    403,
    "SESSION_ACCESS_DENIED",
  );

  const report = await ctx.reports.createSessionReport(
    user(B),
    ids.session.id,
    input,
  );

  assert.deepEqual([report.status, report.blocksSettlement], ["OPEN", true]);
  assert.equal(pathStatus(ctx.db, ids.pathId), "DISPUTED");
  await rejectsWith(
    ctx.reports.createSessionReport(user(B), ids.session.id, input),
    409,
    "ACTIVE_SESSION_REPORT_EXISTS",
  );
  ctx.clock.now = new Date("2026-11-05T00:00:00Z");
  await rejectsWith(
    ctx.reports.createSessionReport(user(A), ids.session.id, input),
    409,
    "DISPUTE_WINDOW_CLOSED",
  );
});

test("SH-091/092: only the assigned staff decides; decisions are audited and release the hold", async () => {
  const ctx = phase3();
  const { caseId, pathId, session } = await openReport(ctx);
  await rejectsWith(
    later(() => ctx.reports.staffQueue(user(B))),
    403,
    "STAFF_ACCESS_REQUIRED",
  );
  assert.equal(await ctx.reports.hasBlockingDispute(ctx.db, pathId), true);

  await ctx.reports.updateCase(staff, caseId, "claim");
  await rejectsWith(
    ctx.reports.updateCase(admin, caseId, "resolve", { note: "Not mine" }),
    403,
    "REPORT_CASE_NOT_ASSIGNED_TO_CALLER",
  );
  await rejectsWith(
    ctx.reports.updateCase(staff, caseId, "resolve", {}),
    409,
    "RESOLUTION_NOTE_REQUIRED",
  );
  const detail = await ctx.reports.staffCaseDetail(staff, caseId);
  assert.deepEqual(
    [detail.session.id, detail.path.participantAId, detail.path.participantBId],
    [session.id, A, B],
  );

  const resolved = await ctx.reports.updateCase(staff, caseId, "resolve", {
    note: "Late join confirmed; no credit impact.",
  });

  assert.equal(resolved.status, "RESOLVED");
  assert.equal(await ctx.reports.hasBlockingDispute(ctx.db, pathId), false);
  assert.equal(pathStatus(ctx.db, pathId), "ACTIVE");
  assert.deepEqual(
    audits(ctx.db, "REPORT_CASE_UPDATE").map(({ after, reason }) => [
      after.status,
      reason,
    ]),
    [
      ["UNDER_REVIEW", "Claimed report case"],
      ["RESOLVED", "Late join confirmed; no credit impact."],
    ],
  );
  const event = ctx.db
    .rows("outboxEvent")
    .find(
      (row) =>
        row.type === "report.case.updated" && row.payload.status === "RESOLVED",
    );
  assert.equal(event.payload.pathId, pathId);
});

test("SH-093: outcomes need resolve, the right permission and path participants", async () => {
  const ctx = phase3();
  const { caseId } = await openReport(ctx);
  await ctx.reports.updateCase(staff, caseId, "claim");
  const note = "Harassment confirmed.";

  await rejectsWith(
    later(() =>
      ctx.reports.updateCase(staff, caseId, "reject", {
        note,
        violations: [{ userId: A, reasonCode: "MEDIUM_HARASSMENT" }],
      }),
    ),
    400,
    "RESOLUTION_OPTIONS_REQUIRE_RESOLVE",
  );
  for (const option of [
    { creditAdjustments: [{ userId: B, amount: "5.00" }] },
    { reversals: [{ operationId: randomUUID() }] },
    { restriction: { userId: A, days: 7 } },
  ]) {
    await rejectsWith(
      later(() =>
        ctx.reports.updateCase(staff, caseId, "resolve", { note, ...option }),
      ),
      403,
      "RESOLUTION_PERMISSION_REQUIRED",
    );
  }
  await rejectsWith(
    ctx.reports.updateCase(staff, caseId, "resolve", {
      note,
      violations: [{ userId: C, reasonCode: "MEDIUM_HARASSMENT" }],
    }),
    400,
    "RESOLUTION_TARGET_NOT_PARTICIPANT",
  );
  assert.ok(
    await invalid(ReportCaseActionDto, { restriction: { userId: A, days: 2 } }),
  );
});

test("SH-082/093: an admin resolution adjusts credit, confirms a violation and locks above the threshold", async () => {
  const ctx = phase3();
  const { caseId, pathId } = await openReport(ctx);
  await ctx.reports.updateCase(admin, caseId, "claim");
  const holdOperation = ctx.db.rows("creditOperation")[0];
  const note = "Repeated harassment; refund the learner and lock the teacher.";

  await ctx.reports.updateCase(admin, caseId, "resolve", {
    note,
    violations: [{ userId: A, reasonCode: "MEDIUM_HARASSMENT" }],
    restriction: { userId: A, days: 30 },
    creditAdjustments: [
      { userId: B, amount: "5.00" },
      { userId: A, amount: "-5.00" },
    ],
    reversals: [{ operationId: holdOperation.id }],
  });

  assert.equal(score(ctx.db, A), 40);
  assert.deepEqual(
    ctx.db
      .rows("userRestriction")
      .filter((row) => row.userId === A)
      .map(({ scope, reasonCode, sourceId, endsAt }) => [
        scope,
        reasonCode,
        sourceId,
        endsAt.toISOString(),
      ]),
    [
      [
        "CREATE_NEW_ACTIVITY",
        "ADJUDICATED_VIOLATION",
        caseId,
        "2026-12-02T11:30:00.000Z",
      ],
      [
        "REQUIRE_ADMIN_REVIEW",
        "ADJUDICATED_VIOLATION",
        caseId,
        "2026-12-02T11:30:00.000Z",
      ],
    ],
  );
  const [lock] = audits(ctx.db, "USER_RESTRICTION_APPLY");
  assert.deepEqual([lock.actorId, lock.reason], [admin.userId, note]);
  assert.deepEqual(
    ctx.adjustments.calls.map(([kind, input]) => [
      kind,
      input.userId ?? input.operationId,
      input.amount,
      input.referenceType,
      input.referenceId,
      input.actorId,
      input.reason,
    ]),
    [
      ["adjust", B, 500n, "REPORT_CASE", caseId, admin.userId, note],
      ["adjust", A, -500n, "REPORT_CASE", caseId, admin.userId, note],
      [
        "reverse",
        holdOperation.id,
        undefined,
        "REPORT_CASE",
        caseId,
        admin.userId,
        note,
      ],
    ],
  );
  assert.deepEqual(
    audits(ctx.db, "CREDIT_ADJUST").map(({ after }) => [
      after.amount,
      after.referenceId,
    ]),
    [
      ["500", caseId],
      ["-500", caseId],
    ],
  );
  assert.equal(audits(ctx.db, "CREDIT_REVERSE").length, 1);
  assert.equal(pathRow(ctx.db, pathId).status, "ACTIVE");
});

test("SH-093: until SH-068 ships, a credit outcome fails instead of being skipped", async () => {
  const ctx = phase3({ adjustments: new UnavailableCreditAdjustmentAdapter() });
  const { caseId } = await openReport(ctx);
  await ctx.reports.updateCase(admin, caseId, "claim");
  await assert.rejects(
    ctx.reports.updateCase(admin, caseId, "resolve", {
      note: "Refund the learner.",
      creditAdjustments: [{ userId: B, amount: "5.00" }],
    }),
    httpError(503, "CREDIT_ADJUSTMENT_UNAVAILABLE"),
  );
});

test("SH-093: a final decision notifies both participants; other updates only the reporter", async () => {
  const ctx = phase3();
  const { pathId } = await completedOneWay(ctx);
  const handler = new LearningPathNotificationHandler(
    { register() {} },
    new NotificationDispatcher(
      fakeOutboxConsumer(ctx.db),
      new PrismaInAppNotificationAdapter(),
      {},
      {},
      new Set(["IN_APP"]),
    ),
    ctx.db,
  );
  const publish = (status) =>
    handler.publish({
      eventId: randomUUID(),
      type: "report.case.updated",
      version: 1,
      payload: { caseId: randomUUID(), reporterId: B, status, pathId },
    });

  await publish("UNDER_REVIEW");
  await publish("RESOLVED");

  assert.deepEqual(
    ctx.db.rows("notification").map(({ userId, body }) => [userId, body]),
    [
      [B, "The report case status is UNDER_REVIEW."],
      [B, "The report case status is RESOLVED."],
      [A, "The report case status is RESOLVED."],
    ],
  );
});
