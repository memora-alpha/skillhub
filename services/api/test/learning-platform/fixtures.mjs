import "reflect-metadata";
import assert from "node:assert/strict";
import { AuditWriter } from "../../dist/modules/audit/application/audit-writer.js";
import { AuditRepository } from "../../dist/modules/audit/infrastructure/audit.repository.js";
import { ConversationMembershipReader } from "../../dist/modules/conversations/conversation-membership.reader.js";
import { CreditLedgerAdapter } from "../../dist/modules/credit/credit-ledger.adapter.js";
import { CreditLedgerService } from "../../dist/modules/credit/application/services/credit-ledger.service.js";
import { CreditWalletReader } from "../../dist/modules/credit/application/services/credit-wallet.reader.js";
import { LearningPathsService } from "../../dist/modules/learning-paths/learning-paths.service.js";
import { LearningSessionsService } from "../../dist/modules/learning-sessions/learning-sessions.service.js";
import { ReportsService } from "../../dist/modules/reports/reports.service.js";
import { SchedulingService } from "../../dist/modules/scheduling/scheduling.service.js";
import { createFakeDb, runner } from "./fake-db.mjs";

export const A = "0a0a0a0a-0000-4000-8000-00000000000a";
export const B = "0b0b0b0b-0000-4000-8000-00000000000b";
export const C = "0c0c0c0c-0000-4000-8000-00000000000c";
export const conversationId = "c0c0c0c0-0000-4000-8000-0000000000c0";
export const user = (userId) => ({ userId, roles: ["USER"], permissions: [] });

/** Values pinned by the system configuration catalog. */
export const defaultConfiguration = {
  "session.durationMinutes": { min: 60, max: 180 },
  "schedule.rescheduleCutoffMinutes": 60,
  "credit.pathSettlementBps": { returned: 9600, fee: 400 },
};

/** Commands run once per scope/operation/key; a repeat replays the stored reference. */
function fakeIdempotency(db) {
  const completed = new Map();
  return {
    async execute(input, work) {
      const id = `${input.scope}:${input.operation}:${input.key}`;
      if (completed.has(id)) {
        return { value: completed.get(id), replayed: true };
      }
      const value = await work(db);
      completed.set(id, value);
      return { value, replayed: false };
    },
  };
}

/** Outbox receipts per consumer and event; a failing delivery leaves no receipt, like a rollback. */
export function fakeOutboxConsumer(db) {
  const receipts = new Set();
  return {
    receipts,
    async processOnce(consumer, eventId, work) {
      const key = `${consumer}:${eventId}`;
      if (receipts.has(key)) return { processed: false };
      const value = await work(db);
      receipts.add(key);
      return { processed: true, value };
    },
  };
}

export function setup({ wallets = {}, config = {} } = {}) {
  const clock = { now: new Date("2026-10-20T00:00:00.000Z") };
  const db = createFakeDb({ now: () => clock.now });
  db.seed("conversation", {
    id: conversationId,
    proposalId: "proposal",
    participantAId: A,
    participantBId: B,
  });
  for (const id of [A, B, C]) {
    db.seed("user", {
      id,
      emailVerified: true,
      accountStatus: "ACTIVE",
      verifiedSkillCount: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  }
  for (const [userId, availableCredit] of Object.entries({
    [A]: 0n,
    [B]: 0n,
    ...wallets,
  })) {
    db.seed("creditWallet", {
      userId,
      availableCredit,
      heldCredit: 0n,
      purchasedCredit: 0n,
      bonusCredit: 0n,
      walletVersion: 0,
    });
  }
  for (const policyCode of ["TWO_WAY", "ONE_WAY"]) {
    db.seed("feePolicyVersion", {
      policyCode,
      versionNo: 1,
      calculationRule: { returnedBps: 9600, feeBps: 400 },
      roundingRule: { mode: "DOWN", precision: 2 },
      status: "APPROVED",
      approvedAt: clock.now,
      effectiveAt: clock.now,
    });
  }
  const values = { ...defaultConfiguration, ...config };
  const configuration = {
    values,
    getSnapshot: async (keys) => ({
      values: Object.fromEntries(keys.map((key) => [key, values[key]])),
    }),
  };
  const wallet = new CreditLedgerAdapter(
    new CreditWalletReader(),
    new CreditLedgerService(),
  );
  const paths = new LearningPathsService(
    runner(db),
    new ConversationMembershipReader(),
    wallet,
    configuration,
    fakeIdempotency(db),
  );
  const schedules = new SchedulingService(
    runner(db),
    new AuditWriter(new AuditRepository()),
    configuration,
  );
  const sessions = new LearningSessionsService(
    runner(db),
    db,
    wallet,
    { applyPathCompletion: async () => {} },
    { evaluate: async () => {} },
    new ReportsService(runner(db), {}, {}, {}),
  );
  return { db, clock, configuration, wallet, paths, schedules, sessions };
}

export const plan = (totalSessions = 1) => ({
  skillId: "5a111111-0000-4000-8000-000000000001",
  learningGoal: "Goal",
  totalSessions,
  sessionOutline: Array.from({ length: totalSessions }, (_, index) => ({
    content: `Session ${index + 1}`,
  })),
});

export const slots = (...ranges) =>
  ranges.map(([startAt, endAt], index) => ({
    sessionNo: index + 1,
    startAt,
    endAt,
  }));

export const rejectsWith = (promise, status, code) =>
  assert.rejects(
    promise,
    (error) => error.getStatus?.() === status && error.message === code,
  );

export async function twoWayWithPlans(ctx, totalCreditPerUser = "20.00") {
  const path = await ctx.paths.create(user(A), {
    conversationId,
    exchangeType: "TWO_WAY",
    totalCreditPerUser,
  });
  const planAB = await ctx.paths.addPlan(user(A), path.id, plan());
  const planBA = await ctx.paths.addPlan(user(B), path.id, plan());
  return { pathId: path.id, planAB, planBA };
}

export async function confirmedTwoWay(ctx, totalCreditPerUser) {
  const ids = await twoWayWithPlans(ctx, totalCreditPerUser);
  await ctx.paths.confirmPlan(user(B), ids.planAB.id, 1);
  await ctx.paths.confirmPlan(user(A), ids.planBA.id, 1);
  await ctx.paths.confirmAgreement(user(A), ids.pathId, 1);
  await ctx.paths.confirmAgreement(user(B), ids.pathId, 1);
  return ids;
}

/** Both schedules proposed by their teachers and confirmed by A and B. */
export async function scheduledTwoWay(ctx, totalCreditPerUser) {
  const ids = await confirmedTwoWay(ctx, totalCreditPerUser);
  for (const [teacher, planId, day] of [
    [A, ids.planAB.id, "02"],
    [B, ids.planBA.id, "03"],
  ]) {
    const schedule = await ctx.schedules.createProposal(user(teacher), planId, {
      expectedPlanVersion: 1,
      items: slots([`2026-11-${day}T10:00:00Z`, `2026-11-${day}T11:00:00Z`]),
    });
    await ctx.schedules.confirmProposal(user(A), schedule.id, 1);
    await ctx.schedules.confirmProposal(user(B), schedule.id, 1);
  }
  return ids;
}

/** ONE_WAY: A teaches B one session for negotiatedCredit, fully confirmed and scheduled. */
export async function scheduledOneWay(ctx, negotiatedCredit = "100.00") {
  const path = await ctx.paths.create(user(B), {
    conversationId,
    exchangeType: "ONE_WAY",
    teacherId: A,
    learnerId: B,
    negotiatedCredit,
  });
  const onlyPlan = await ctx.paths.addPlan(user(A), path.id, plan());
  await ctx.paths.confirmPlan(user(B), onlyPlan.id, 1);
  await ctx.paths.confirmAgreement(user(A), path.id, 1);
  await ctx.paths.confirmAgreement(user(B), path.id, 1);
  const schedule = await ctx.schedules.createProposal(user(A), onlyPlan.id, {
    expectedPlanVersion: 1,
    items: slots(["2026-11-02T10:00:00Z", "2026-11-02T11:00:00Z"]),
  });
  await ctx.schedules.confirmProposal(user(A), schedule.id, 1);
  await ctx.schedules.confirmProposal(user(B), schedule.id, 1);
  return { pathId: path.id, planId: onlyPlan.id, scheduleId: schedule.id };
}

export const finalizeAs = (ctx, userId, pathId, key = "finalize-1") =>
  ctx.paths.finalize({ principal: user(userId), key }, pathId, 1);

/** ONE_WAY locked with its single session (2026-11-02 10:00-11:00 UTC). */
export async function finalizedOneWay(ctx) {
  const ids = await scheduledOneWay(ctx);
  await finalizeAs(ctx, A, ids.pathId);
  const session = ctx.db.rows("session").find((s) => s.pathId === ids.pathId);
  return { ...ids, session };
}

/** Both participants confirmed the session; the path is ACTIVE. */
export async function completedOneWay(ctx) {
  const ids = await finalizedOneWay(ctx);
  ctx.clock.now = new Date("2026-11-02T11:30:00Z");
  await ctx.sessions.complete(user(A), ids.session.id, "Taught");
  await ctx.sessions.complete(user(B), ids.session.id, "Learned");
  return ids;
}

/** Settled after the dispute window; the path is COMPLETED. */
export async function settledOneWay(ctx) {
  const ids = await completedOneWay(ctx);
  ctx.clock.now = new Date("2026-11-05T00:00:00Z");
  await ctx.sessions.settlePath(user(B), ids.pathId);
  return ids;
}

export const pathRow = (db, pathId) =>
  db.rows("learningPath").find((row) => row.id === pathId);

export const pathStatus = (db, pathId) => pathRow(db, pathId).status;

export const wallet = (db, userId) =>
  db.rows("creditWallet").find((row) => row.userId === userId);
