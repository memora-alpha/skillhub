import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  setup,
  finalizedOneWay,
  completedOneWay,
  user,
  A,
  B,
  C,
  plan,
  slots,
  conversationId,
  finalizeAs,
} from "../learning-platform/fixtures.mjs";
import { runner } from "../learning-platform/fake-db.mjs";
import {
  makeupQuota,
  reserveMakeup,
} from "../../dist/modules/learning-sessions/application/services/makeup-quota.js";
import { SessionChangesService } from "../../dist/modules/learning-sessions/application/services/session-changes.service.js";
import { LearningChangeState } from "../../dist/modules/learning-paths/application/services/learning-change-state.js";
import { AuditWriter } from "../../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../../dist/modules/audit/infrastructure/persistence/audit.repository.js";
import { PathSettlementStatusService } from "../../dist/modules/learning-paths/application/services/path-settlement-status.service.js";

const error = (message) => ({ message });
const audit = () => new AuditWriter(new AuditRepository());
async function multipleSessions(count) {
  const ctx = setup({ wallets: { [B]: 10000n } });
  const path = await ctx.paths.create(user(B), {
    conversationId,
    exchangeType: "ONE_WAY",
    teacherId: A,
    learnerId: B,
    negotiatedCredit: "100.00",
  });
  const p = await ctx.paths.addPlan(user(A), path.id, plan(count));
  await ctx.paths.confirmPlan(user(B), p.id, 1);
  await ctx.paths.confirmAgreement(user(A), path.id, 1);
  await ctx.paths.confirmAgreement(user(B), path.id, 1);
  const schedule = await ctx.schedules.createProposal(user(A), p.id, {
    expectedPlanVersion: 1,
    items: slots(
      ...Array.from({ length: count }, (_, i) => [
        `2026-11-${String(i + 2).padStart(2, "0")}T10:00:00Z`,
        `2026-11-${String(i + 2).padStart(2, "0")}T11:00:00Z`,
      ]),
    ),
  });
  await ctx.schedules.confirmProposal(user(A), schedule.id, 1);
  await ctx.schedules.confirmProposal(user(B), schedule.id, 1);
  await finalizeAs(ctx, A, path.id);
  return {
    ...ctx,
    pathId: path.id,
    scheduleId: schedule.id,
    sessionsInPlan: ctx.db.rows("session"),
  };
}
async function move(ctx, session, startAt, endAt) {
  const current = ctx.db
    .rows("scheduleProposal")
    .find((p) => p.id === ctx.scheduleId);
  const proposal = await ctx.schedules.proposeReschedule(user(A), session.id, {
    expectedVersion: current.currentVersion,
    startAt,
    endAt,
  });
  await ctx.schedules.confirmProposal(
    user(A),
    ctx.scheduleId,
    proposal.version,
  );
  await ctx.schedules.confirmProposal(
    user(B),
    ctx.scheduleId,
    proposal.version,
  );
  return proposal;
}

test("personal quota floors 20 percent and charges only the requester", async () => {
  for (const [total, limit] of [
    [1, 1],
    [4, 1],
    [5, 1],
    [6, 1],
    [9, 1],
    [10, 2],
  ]) {
    const ctx = await multipleSessions(total);
    assert.equal(
      (await makeupQuota(ctx.db, ctx.sessionsInPlan[0], A)).limit,
      limit,
    );
    await reserveMakeup(ctx.db, ctx.sessionsInPlan[0], [A]);
    await assert.rejects(
      () => reserveMakeup(ctx.db, ctx.sessionsInPlan[0], [A]),
      error("SESSION_MAKEUP_LIMIT_REACHED"),
    );
    if (total > 1 && limit === 1)
      await assert.rejects(
        () => reserveMakeup(ctx.db, ctx.sessionsInPlan[1], [A]),
        error("USER_MAKEUP_LIMIT_REACHED"),
      );
    assert.equal((await makeupQuota(ctx.db, ctx.sessionsInPlan[0], B)).used, 0);
    assert.equal(
      (await makeupQuota(ctx.db, ctx.sessionsInPlan[0], B)).remaining,
      limit,
    );
  }
});

test("one person's quota spans both directions and a partner retains their own allowance", async () => {
  const ctx = await multipleSessions(6);
  const originals = [...ctx.sessionsInPlan];
  const reversePlanId = randomUUID();
  const reverse = originals.map((row) =>
    ctx.db.seed("session", {
      ...row,
      id: randomUUID(),
      planId: reversePlanId,
      teacherId: B,
      learnerId: A,
      makeupCount: 0,
      makeupUserIds: [],
    }),
  );
  assert.equal((await makeupQuota(ctx.db, originals[0], A)).totalSessions, 12);
  assert.equal((await makeupQuota(ctx.db, originals[0], A)).limit, 2);
  await reserveMakeup(ctx.db, originals[0], [A]);
  await reserveMakeup(ctx.db, reverse[0], [A]);
  await assert.rejects(
    () => reserveMakeup(ctx.db, originals[1], [A]),
    error("USER_MAKEUP_LIMIT_REACHED"),
  );
  assert.equal((await makeupQuota(ctx.db, reverse[1], B)).remaining, 2);
  await reserveMakeup(ctx.db, originals[1], [B]);
  assert.equal((await makeupQuota(ctx.db, reverse[1], B)).used, 1);
  assert.equal((await makeupQuota(ctx.db, reverse[1], A)).used, 2);
});

test("both absent participants use their own allowance; invalid and unknown attribution cannot grant makeup", async () => {
  const ctx = await multipleSessions(6);
  await assert.rejects(
    () => reserveMakeup(ctx.db, ctx.sessionsInPlan[0], []),
    error("MAKEUP_USER_REQUIRED"),
  );
  await assert.rejects(
    () => reserveMakeup(ctx.db, ctx.sessionsInPlan[0], [C]),
    error("MAKEUP_USER_NOT_PARTICIPANT"),
  );
  await reserveMakeup(ctx.db, ctx.sessionsInPlan[0], [B, A, A]);
  assert.deepEqual(ctx.sessionsInPlan[0].makeupUserIds, [A, B]);
  await assert.rejects(
    () => reserveMakeup(ctx.db, ctx.sessionsInPlan[1], [B]),
    error("USER_MAKEUP_LIMIT_REACHED"),
  );
  const legacy = await multipleSessions(6);
  legacy.sessionsInPlan[0].makeupCount = 1;
  await assert.rejects(
    () => reserveMakeup(legacy.db, legacy.sessionsInPlan[1], [A]),
    error("MAKEUP_ATTRIBUTION_REVIEW_REQUIRED"),
  );
});

test("cancellation and absence share one quota and same-Session makeup cannot be granted twice", async () => {
  const ctx = await multipleSessions(6);
  const cancellations = new SessionChangesService(
    runner(ctx.db),
    new LearningChangeState(audit(), ctx.configuration),
  );
  const first = ctx.sessionsInPlan[0];
  const request = await cancellations.request(user(A), first.id, "first", {
    reason: "Cancel for makeup",
    expectedStartAt: first.startAt.toISOString(),
  });
  await cancellations.respond(user(B), first.id, request.id, {
    expectedVersion: 1,
    accept: true,
  });
  await cancellations.respond(user(B), first.id, request.id, {
    expectedVersion: 1,
    accept: true,
  });
  assert.equal(first.makeupCount, 1);
  assert.equal(first.rescheduleCount, 0);
  await assert.rejects(
    () => reserveMakeup(ctx.db, ctx.sessionsInPlan[1], [A]),
    error("USER_MAKEUP_LIMIT_REACHED"),
  );
  const held = ctx.db
    .rows("creditWallet")
    .find((w) => w.userId === B).heldCredit;
  assert.equal(held, 10000n);
  assert.equal(ctx.db.rows("creditOperation").length, 1);
});

test("ordinary reschedules count only bilateral changes, cap at three, and retain original 48h anchor", async () => {
  const ctx = setup({ wallets: { [B]: 10000n } });
  Object.assign(ctx, await finalizedOneWay(ctx));
  const original = +ctx.session.startAt;
  const pending = await ctx.schedules.proposeReschedule(
    user(A),
    ctx.session.id,
    {
      expectedVersion: 1,
      startAt: "2026-11-02T12:00:00Z",
      endAt: "2026-11-02T13:00:00Z",
    },
  );
  await ctx.schedules.confirmProposal(user(A), ctx.scheduleId, pending.version);
  assert.equal(ctx.session.rescheduleCount, 0);
  await ctx.schedules.confirmProposal(user(B), ctx.scheduleId, pending.version);
  await ctx.schedules.confirmProposal(user(B), ctx.scheduleId, pending.version);
  assert.equal(ctx.session.rescheduleCount, 1);
  await assert.rejects(
    () =>
      move(
        ctx,
        ctx.session,
        "2026-11-04T10:00:00.001Z",
        "2026-11-04T11:00:00.001Z",
      ),
    error("LAST_SESSION_RESCHEDULE_WINDOW_EXCEEDED"),
  );
  await move(ctx, ctx.session, "2026-11-03T12:00:00Z", "2026-11-03T13:00:00Z");
  await move(ctx, ctx.session, "2026-11-04T10:00:00Z", "2026-11-04T11:00:00Z");
  assert.equal(+ctx.session.originalStartAt, original);
  assert.equal(ctx.session.rescheduleCount, 3);
  await assert.rejects(
    () =>
      move(ctx, ctx.session, "2026-11-04T09:00:00Z", "2026-11-04T10:00:00Z"),
    error("SESSION_RESCHEDULE_LIMIT_REACHED"),
  );
  await move(ctx, ctx.session, "2026-11-04T10:00:00Z", "2026-11-04T11:00:00Z");
  assert.equal(ctx.session.rescheduleCount, 3);
});

test("reschedule preserves order and revalidates quota on second confirmation", async () => {
  const ctx = await multipleSessions(2);
  const [first, last] = ctx.sessionsInPlan;
  await assert.rejects(
    () => move(ctx, first, "2026-11-04T10:00:00Z", "2026-11-04T11:00:00Z"),
    error("RESCHEDULE_SESSION_ORDER_VIOLATION"),
  );
  await assert.rejects(
    () => move(ctx, last, "2026-11-02T08:00:00Z", "2026-11-02T09:00:00Z"),
    error("RESCHEDULE_SESSION_ORDER_VIOLATION"),
  );
  const proposal = await ctx.schedules.proposeReschedule(user(A), first.id, {
    expectedVersion: 1,
    startAt: "2026-11-02T12:00:00Z",
    endAt: "2026-11-02T13:00:00Z",
  });
  await ctx.schedules.confirmProposal(
    user(A),
    ctx.scheduleId,
    proposal.version,
  );
  first.rescheduleCount = 3;
  await assert.rejects(
    () =>
      ctx.schedules.confirmProposal(user(B), ctx.scheduleId, proposal.version),
    error("SESSION_RESCHEDULE_LIMIT_REACHED"),
  );
});

test("makeup booking is separate from ordinary reschedule count and last-session window", async () => {
  const ctx = setup({ wallets: { [B]: 10000n } });
  Object.assign(ctx, await finalizedOneWay(ctx));
  const cancellations = new SessionChangesService(
    runner(ctx.db),
    new LearningChangeState(audit(), ctx.configuration),
  );
  const request = await cancellations.request(
    user(A),
    ctx.session.id,
    "makeup",
    {
      reason: "Cancel for makeup",
      expectedStartAt: ctx.session.startAt.toISOString(),
    },
  );
  await cancellations.respond(user(B), ctx.session.id, request.id, {
    expectedVersion: 1,
    accept: true,
  });
  ctx.session.rescheduleCount = 3;
  await move(ctx, ctx.session, "2026-11-06T10:00:00Z", "2026-11-06T11:00:00Z");
  assert.equal(ctx.session.rescheduleCount, 3);
  assert.equal(ctx.session.makeupCount, 1);
  const again = await cancellations.request(user(A), ctx.session.id, "again", {
    reason: "Request second makeup",
    expectedStartAt: ctx.session.startAt.toISOString(),
  });
  await assert.rejects(
    () =>
      cancellations.respond(user(B), ctx.session.id, again.id, {
        expectedVersion: 1,
        accept: true,
      }),
    error("SESSION_MAKEUP_LIMIT_REACHED"),
  );
});

test("completion is not financial consent; both explicit consents settle immediately and replay once", async () => {
  const ctx = setup({ wallets: { [B]: 10000n } });
  const { pathId } = await completedOneWay(ctx);
  const status = new PathSettlementStatusService(
    runner(ctx.db),
    ctx.sessions.reports,
  );
  assert.equal(
    (await status.read(user(A), pathId)).immediateSettlement.ownApprovedAt,
    null,
  );
  await assert.rejects(
    () => ctx.sessions.approveImmediateSettlement(user(C), pathId, 1),
    error("LEARNING_PATH_ACCESS_DENIED"),
  );
  await assert.rejects(
    () => ctx.sessions.approveImmediateSettlement(user(A), pathId, 2),
    error("STALE_PATH_VERSION"),
  );
  const first = await ctx.sessions.approveImmediateSettlement(
    user(A),
    pathId,
    1,
  );
  assert.equal(first.settlement.outcome, "WAITING");
  assert.equal(first.bothApproved, false);
  assert.equal(
    ctx.db.rows("creditWallet").find((w) => w.userId === B).heldCredit,
    10000n,
  );
  assert.equal(
    (await status.read(user(B), pathId)).immediateSettlement.canApprove,
    true,
  );
  const repeated = await ctx.sessions.approveImmediateSettlement(
    user(A),
    pathId,
    1,
  );
  assert.equal(+repeated.approvedAt, +first.approvedAt);
  assert.equal(
    ctx.db
      .rows("auditLog")
      .filter((r) => r.action === "PATH_SETTLEMENT_CONSENT").length,
    1,
  );
  const second = await ctx.sessions.approveImmediateSettlement(
    user(B),
    pathId,
    1,
  );
  assert.equal(second.settlement.outcome, "SETTLED");
  assert.equal(
    ctx.db.rows("creditWallet").find((w) => w.userId === A).availableCredit,
    9600n,
  );
  const count = ctx.db.rows("creditTransaction").length;
  await ctx.sessions.approveImmediateSettlement(user(B), pathId, 1);
  assert.equal(ctx.db.rows("creditTransaction").length, count);
  assert.equal((await status.read(user(A), pathId)).status, "SETTLED");
});

test("report clears consent and blocks immediate settlement until resolution and new approvals", async () => {
  const ctx = setup({ wallets: { [B]: 10000n } });
  const { pathId, session } = await completedOneWay(ctx);
  await ctx.sessions.approveImmediateSettlement(user(A), pathId, 1);
  await ctx.sessions.reports.createSessionReport(user(B), session.id, {
    reasonCode: "TECHNICAL_ISSUE",
    description: "Review technical issues",
    evidenceFileIds: [],
  });
  const path = ctx.db.rows("learningPath")[0];
  assert.equal(path.participantASettlementApprovedAt, null);
  assert.equal(path.participantBSettlementApprovedAt, null);
  await assert.rejects(
    () => ctx.sessions.approveImmediateSettlement(user(B), pathId, 1),
    error("SETTLEMENT_BLOCKED_BY_DISPUTE"),
  );
  assert.equal(
    ctx.db.rows("creditTransaction").filter((r) => r.type !== "HOLD").length,
    0,
  );
});

test("consent before completion is rejected; ordinary 48-hour settlement remains available", async () => {
  const ctx = setup({ wallets: { [B]: 10000n } });
  const { pathId } = await finalizedOneWay(ctx);
  await assert.rejects(
    () => ctx.sessions.approveImmediateSettlement(user(A), pathId, 1),
    error("LEARNING_PATH_NOT_SETTLEABLE"),
  );
  const completed = setup({ wallets: { [B]: 10000n } });
  const ids = await completedOneWay(completed);
  completed.clock.now = new Date("2026-11-04T10:59:59.999Z");
  await assert.rejects(
    () => completed.sessions.settlePath(user(B), ids.pathId),
    error("DISPUTE_WINDOW_OPEN"),
  );
  completed.clock.now = new Date("2026-11-04T11:00:00Z");
  await completed.sessions.settlePath(user(B), ids.pathId);
  assert.ok(completed.db.rows("learningPath")[0].settledAt);
});
