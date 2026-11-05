import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { AuditWriter } from "../../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../../dist/modules/audit/infrastructure/persistence/audit.repository.js";
import { LearningChangeState } from "../../dist/modules/learning-paths/application/services/learning-change-state.js";
import { PathTerminationService } from "../../dist/modules/learning-paths/application/services/path-termination.service.js";
import { readTerminationQuote } from "../../dist/modules/credit/application/services/termination-quote.reader.js";
import { SessionChangesService } from "../../dist/modules/learning-sessions/application/services/session-changes.service.js";
import { PathSettlementStatusService } from "../../dist/modules/learning-paths/application/services/path-settlement-status.service.js";
import { SessionOutcomeService } from "../../dist/modules/learning-sessions/application/services/session-outcome.service.js";
import { ReportsService } from "../../dist/modules/reports/application/services/reports.service.js";
import { settlementFailure } from "../../dist/modules/learning-paths/application/services/path-settlement-state.js";
import { LearningChangeRecoveryWorker } from "../../dist/modules/learning-sessions/infrastructure/jobs/learning-change-recovery.worker.js";
import { refreshPathStatus } from "../../dist/modules/learning-sessions/application/services/session-transitions.js";
import { runner } from "../learning-platform/fake-db.mjs";
import {
  setup,
  finalizedOneWay,
  user,
  A,
  B,
  C,
} from "../learning-platform/fixtures.mjs";

const admin = {
  userId: C,
  roles: ["ADMIN"],
  permissions: ["report:moderate", "credit:adjust", "dispute:override"],
};
async function fixture() {
  const ctx = setup({ wallets: { [B]: 10000n } });
  const ids = await finalizedOneWay(ctx);
  const audit = new AuditWriter(new AuditRepository());
  const state = new LearningChangeState(audit, ctx.configuration);
  const cancellations = new SessionChangesService(runner(ctx.db), state);
  const stop = new PathTerminationService(
    runner(ctx.db),
    state,
    cancellations,
    {
      previewHeld: readTerminationQuote,
      distributeHeld: async () => {
        throw new Error("Unexpected financial execution");
      },
    },
    ctx.requests,
    ctx.requestPaths,
  );
  const reports = new ReportsService(
    runner(ctx.db),
    {},
    {},
    audit,
    { applyNoShow: async () => {} },
    {},
    ctx.configuration,
    cancellations,
  );
  const status = new PathSettlementStatusService(runner(ctx.db), reports);
  const cancel = (key = "cancel-1") =>
    cancellations.request(user(A), ids.session.id, key, {
      reason: "Please agree to a makeup class",
      expectedStartAt: ids.session.startAt.toISOString(),
    });
  return {
    ...ctx,
    ...ids,
    state,
    cancellations,
    stop,
    reports,
    status,
    cancel,
  };
}

test("cancellation requires the other participant, retains 2/5 progress, and makeup completes once", async () => {
  const ctx = await fixture();
  for (let i = 0; i < 4; i++)
    ctx.db.seed("session", {
      ...ctx.session,
      id: randomUUID(),
      status: i < 2 ? "COMPLETED" : "CONFIRMED",
    });
  const request = await ctx.cancel();
  assert.equal(ctx.db.rows("session")[0].status, "CONFIRMED");
  await assert.rejects(
    () =>
      ctx.cancellations.respond(user(A), ctx.session.id, request.id, {
        expectedVersion: 1,
        accept: true,
      }),
    { message: "PARTNER_DECISION_REQUIRED" },
  );
  const result = await ctx.cancellations.respond(
    user(B),
    ctx.session.id,
    request.id,
    { expectedVersion: 1, accept: true },
  );
  assert.equal(result.status, "APPLIED");
  assert.equal(ctx.db.rows("session")[0].status, "MAKEUP_REQUIRED");
  assert.deepEqual(
    (await ctx.sessions.detail(user(A), ctx.session.id)).progress.agreement,
    { completed: 2, total: 5 },
  );
  const nextStart = "2026-11-04T10:00:00Z",
    nextEnd = "2026-11-04T11:00:00Z";
  const proposal = await ctx.schedules.proposeReschedule(
    user(A),
    ctx.session.id,
    { expectedVersion: 1, startAt: nextStart, endAt: nextEnd },
  );
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
  assert.equal(ctx.db.rows("session").length, 5);
  ctx.clock.now = new Date("2026-11-04T11:30:00Z");
  await ctx.sessions.complete(user(A), ctx.session.id, "Taught makeup");
  await ctx.sessions.complete(user(B), ctx.session.id, "Learned makeup");
  await ctx.sessions.complete(user(B), ctx.session.id, "Repeat");
  assert.deepEqual(
    (await ctx.sessions.detail(user(A), ctx.session.id)).progress.agreement,
    { completed: 3, total: 5 },
  );
  assert.equal(
    ctx.db.rows("creditOperation").length,
    1,
    "only original Hold exists",
  );
});

test("request and response retries preserve history; another key cannot create a second pending request", async () => {
  const ctx = await fixture();
  const first = await ctx.cancel();
  assert.equal((await ctx.cancel()).id, first.id);
  await assert.rejects(() => ctx.cancel("different"), {
    message: "CHANGE_REQUEST_ALREADY_PENDING",
  });
  const applied = await ctx.cancellations.respond(
    user(B),
    ctx.session.id,
    first.id,
    { expectedVersion: 1, accept: true },
  );
  const auditCount = ctx.db.rows("auditLog").length;
  assert.deepEqual(
    await ctx.cancellations.respond(user(B), ctx.session.id, first.id, {
      expectedVersion: 1,
      accept: true,
    }),
    applied,
  );
  assert.equal(ctx.db.rows("auditLog").length, auditCount);
  assert.equal(ctx.db.rows("learningChangeRequest").length, 1);
});

test("outsiders, stale occurrences and conflicting idempotency keys cannot cancel a class", async () => {
  const ctx = await fixture();
  await assert.rejects(
    () =>
      ctx.cancellations.request(user(C), ctx.session.id, "key", {
        reason: "Cancel",
        expectedStartAt: ctx.session.startAt.toISOString(),
      }),
    { message: "LEARNING_PATH_ACCESS_DENIED" },
  );
  await assert.rejects(
    () =>
      ctx.cancellations.request(user(A), ctx.session.id, "key", {
        reason: "Cancel",
        expectedStartAt: "2026-11-01T10:00:00Z",
      }),
    { message: "STALE_SESSION_OCCURRENCE" },
  );
  await ctx.cancel();
  await assert.rejects(
    () =>
      ctx.cancellations.request(user(A), ctx.session.id, "cancel-1", {
        reason: "Different instruction",
        expectedStartAt: ctx.session.startAt.toISOString(),
      }),
    { message: "CHANGE_REQUEST_KEY_CONFLICT" },
  );
});

test("rejected or withdrawn cancellation keeps the old schedule; original start expires unanswered requests", async () => {
  const ctx = await fixture();
  const rejected = await ctx.cancel();
  await ctx.cancellations.respond(user(B), ctx.session.id, rejected.id, {
    expectedVersion: 1,
    accept: false,
  });
  assert.equal(ctx.db.rows("session")[0].status, "CONFIRMED");
  const withdrawn = await ctx.cancel("second");
  await ctx.cancellations.withdraw(user(A), ctx.session.id, withdrawn.id, 1);
  const expiring = await ctx.cancel("third");
  ctx.clock.now = new Date(ctx.session.startAt);
  const rows = await ctx.cancellations.list(user(B), ctx.session.id);
  assert.equal(rows.find((row) => row.id === expiring.id).status, "EXPIRED");
  assert.equal(ctx.db.rows("session")[0].status, "CONFIRMED");
});

test("a blocking dispute defers cancellation execution and recovery revalidates the occurrence", async () => {
  const ctx = await fixture();
  ctx.db.seed("reportCase", {
    id: randomUUID(),
    relatedPathId: ctx.pathId,
    blocksSettlement: true,
    status: "OPEN",
  });
  const row = await ctx.cancel();
  const accepted = await ctx.cancellations.respond(
    user(B),
    ctx.session.id,
    row.id,
    { expectedVersion: 1, accept: true },
  );
  assert.equal(accepted.status, "ACCEPTED");
  assert.equal(accepted.blockedByDispute, true);
  assert.equal(ctx.db.rows("session")[0].status, "CONFIRMED");
  await ctx.db.reportCase.updateMany({
    where: { relatedPathId: ctx.pathId },
    data: { status: "RESOLVED", blocksSettlement: false },
  });
  assert.equal(
    (await ctx.cancellations.recover(ctx.session.id, row.id)).status,
    "APPLIED",
  );
});

test("a reschedule makes an old pending cancellation expire without cancelling the new occurrence", async () => {
  const ctx = await fixture();
  const row = await ctx.cancel();
  await ctx.db.session.update({
    where: { id: ctx.session.id },
    data: { startAt: new Date("2026-11-05T10:00:00Z") },
  });
  const decided = await ctx.cancellations.respond(
    user(B),
    ctx.session.id,
    row.id,
    { expectedVersion: 1, accept: true },
  );
  assert.equal(decided.status, "EXPIRED");
  assert.equal(ctx.db.rows("session")[0].status, "CONFIRMED");
});

test("cancelled makeup expiry has a Staff resolution even without an attendance outcome", async () => {
  const ctx = await fixture();
  const row = await ctx.cancel();
  await ctx.cancellations.respond(user(B), ctx.session.id, row.id, {
    expectedVersion: 1,
    accept: true,
  });
  ctx.clock.now = new Date(ctx.db.rows("session")[0].makeupDeadlineAt);
  await new SessionOutcomeService(runner(ctx.db), {}, ctx.reports).finalizeDue(
    ctx.session.id,
  );
  assert.equal(ctx.db.rows("session")[0].status, "DISPUTED");
  const report = ctx.db.rows("reportCase")[0];
  await ctx.reports.updateCase(admin, report.id, "claim");
  await ctx.reports.updateCase(admin, report.id, "resolve", {
    note: "Both parties agreed to extend makeup",
    cancellationMakeupRuling: "EXTEND",
  });
  assert.equal(ctx.db.rows("session")[0].status, "MAKEUP_REQUIRED");
  assert.ok(ctx.db.rows("session")[0].makeupDeadlineAt > ctx.clock.now);
  assert.equal(
    ctx.db.rows("sessionAttendanceOutcome").length,
    0,
    "no fabricated attendance evidence",
  );
});

test("bilateral approval stops future obligations and holds money until the policy is enabled", async () => {
  const ctx = await fixture();
  const row = await ctx.stop.request(
    user(A),
    ctx.pathId,
    "stop",
    "End the agreement early",
  );
  const accepted = await ctx.stop.respond(user(B), ctx.pathId, row.id, {
    expectedVersion: 1,
    accept: true,
  });
  assert.equal(accepted.awaitingPolicy, true);
  assert.ok(accepted.approvedAt);
  assert.equal(ctx.db.rows("session")[0].status, "CANCELLED");
  assert.equal(ctx.db.rows("creditOperation").length, 1);
  await assert.rejects(
    () => ctx.stop.withdraw(user(A), ctx.pathId, row.id, accepted.version),
    /TERMINATION_ALREADY_APPROVED/,
  );
  ctx.clock.now = new Date(+accepted.expiresAt + 1);
  await ctx.state.expire(ctx.db, ctx.pathId, ctx.clock.now);
  assert.equal(ctx.db.rows("learningChangeRequest")[0].status, "ACCEPTED");
  assert.equal(
    (await ctx.status.read(user(A), ctx.pathId)).status,
    "WAITING_TERMINATION",
  );
});

test("pending termination blocks full settlement; withdrawing it permits the ordinary settlement once", async () => {
  const ctx = await fixture();
  const row = await ctx.stop.request(
    user(A),
    ctx.pathId,
    "stop",
    "End the agreement early",
  );
  // Complete the existing session and stay inside the configured request window.
  ctx.clock.now = new Date("2026-11-02T11:30:00Z");
  await ctx.sessions.complete(user(A), ctx.session.id, "Taught");
  await ctx.sessions.complete(user(B), ctx.session.id, "Learned");
  // The first request expired; create a current termination request on the ACTIVE path.
  const current = await ctx.stop.request(
    user(A),
    ctx.pathId,
    "current-stop",
    "Discuss ending the agreement",
  );
  ctx.clock.now = new Date("2026-11-04T12:00:00Z");
  await assert.rejects(() => ctx.sessions.settlePath(user(A), ctx.pathId), {
    message: "SETTLEMENT_BLOCKED_BY_TERMINATION",
  });
  assert.equal(
    (await ctx.status.read(user(A), ctx.pathId)).status,
    "WAITING_TERMINATION",
  );
  await ctx.stop.withdraw(user(A), ctx.pathId, current.id, current.version);
  await ctx.sessions.settlePath(user(B), ctx.pathId);
  await ctx.sessions.settlePath(user(B), ctx.pathId);
  assert.equal((await ctx.status.read(user(A), ctx.pathId)).status, "SETTLED");
  assert.equal(
    ctx.db
      .rows("creditOperation")
      .filter((op) => op.operationType === "PATH_SETTLEMENT").length,
    1,
  );
  assert.equal(
    ctx.db.rows("learningChangeRequest").find((item) => item.id === row.id)
      .status,
    "EXPIRED",
  );
});

test("settlement diagnostics distinguish review from retry without exposing raw exceptions", () => {
  assert.equal(
    settlementFailure(new Error("PATH_HOLD_BALANCE_MISMATCH")).outcome,
    "NEEDS_REVIEW",
  );
  assert.deepEqual(settlementFailure(new Error("postgres://secret@private")), {
    outcome: "RETRYING",
    errorCode: "SETTLEMENT_TEMPORARILY_UNAVAILABLE",
  });
});

test("automatic expiry removes a termination settlement block without touching Held", async () => {
  const ctx = await fixture();
  const row = await ctx.stop.request(
    user(A),
    ctx.pathId,
    "expire",
    "Please end this agreement",
  );
  ctx.clock.now = new Date(+new Date(row.expiresAt) + 1);
  const recovery = new LearningChangeRecoveryWorker(
    ctx.db,
    runner(ctx.db),
    ctx.state,
    ctx.cancellations,
  );
  await recovery.sweep();
  recovery.onModuleDestroy();
  assert.equal(ctx.db.rows("learningChangeRequest")[0].status, "EXPIRED");
  assert.equal(
    (await ctx.status.read(user(A), ctx.pathId)).status,
    "WAITING_SESSIONS",
  );
  assert.equal(
    ctx.db.rows("creditWallet").find((wallet) => wallet.userId === B)
      .heldCredit,
    10000n,
  );
});

test("settlement findings survive failure and expose a safe actionable review state", async () => {
  const ctx = await fixture();
  ctx.clock.now = new Date("2026-11-02T11:30:00Z");
  await ctx.sessions.complete(user(A), ctx.session.id, "Taught");
  await ctx.sessions.complete(user(B), ctx.session.id, "Learned");
  ctx.clock.now = new Date("2026-11-05T12:00:00Z");
  await ctx.db.feePolicyVersion.updateMany({
    where: { policyCode: "ONE_WAY" },
    data: { status: "DRAFT" },
  });
  await assert.rejects(() => ctx.sessions.settlePath(user(B), ctx.pathId), {
    message: "UNSUPPORTED_FEE_POLICY",
  });
  const view = await ctx.status.read(user(B), ctx.pathId);
  assert.equal(view.status, "NEEDS_REVIEW");
  assert.equal(view.reasonCode, "UNSUPPORTED_FEE_POLICY");
  assert.equal(view.nextAction, "CONTACT_SUPPORT");
  assert.equal(+view.lastCheckedAt, +ctx.clock.now);
  assert.equal(view.attemptCount, 1);
});

test("late completion/report events cannot reopen a terminated agreement", async () => {
  const ctx = await fixture();
  await ctx.db.learningPath.update({
    where: { id: ctx.pathId },
    data: { status: "CANCELLED" },
  });
  await ctx.db.session.update({
    where: { id: ctx.session.id },
    data: { status: "COMPLETED" },
  });
  await refreshPathStatus(ctx.db, ctx.pathId);
  await ctx.reports.openSystemSessionCase(ctx.db, {
    pathId: ctx.pathId,
    sessionId: ctx.session.id,
    reasonCode: "MAKEUP_EXPIRED",
    description: "A delayed case event",
  });
  assert.equal(ctx.db.rows("learningPath")[0].status, "CANCELLED");
  assert.equal(ctx.db.rows("reportCase")[0].blocksSettlement, false);
});
