import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Test } from "@nestjs/testing";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { PathTerminationController } from "../../dist/modules/learning-paths/presentation/http/path-termination.controller.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { AuditWriter } from "../../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../../dist/modules/audit/infrastructure/persistence/audit.repository.js";
import { LearningChangeState } from "../../dist/modules/learning-paths/application/services/learning-change-state.js";
import { PathTerminationService } from "../../dist/modules/learning-paths/application/services/path-termination.service.js";
import { SessionChangesService } from "../../dist/modules/learning-sessions/application/services/session-changes.service.js";
import { SessionOutcomeService } from "../../dist/modules/learning-sessions/application/services/session-outcome.service.js";
import { PathTerminationRecoveryWorker } from "../../dist/modules/learning-paths/infrastructure/jobs/path-termination-recovery.worker.js";
import { PathTerminationLedgerService } from "../../dist/modules/credit/application/services/path-termination-ledger.service.js";
import { CreditOperationsService } from "../../dist/modules/credit/application/services/credit-operations.service.js";
import { allocateHeldFee } from "../../dist/modules/credit/domain/session-credit.js";
import { runner } from "../learning-platform/fake-db.mjs";
import {
  setup,
  plan,
  conversationId,
  finalizeAs,
  A,
  B,
  C,
  user,
} from "../learning-platform/fixtures.mjs";

const staff = {
  ...user(C),
  roles: ["STAFF"],
  permissions: ["report:moderate", "learning-path:terminate"],
};

async function fixture(counts = [5, 3], credit = "100.00") {
  const ctx = setup({
    wallets: { [A]: 20000n, [B]: 20000n },
    config: {
      "learningPath.changeRequests": {
        requestWindowHours: 72,
        terminationPolicyReference: "approved-plan-v2",
      },
    },
  });
  const path = await ctx.paths.create(user(A), {
    conversationId,
    exchangeType: "TWO_WAY",
    totalCreditPerUser: credit,
  });
  const plans = [];
  for (const [index, teacher, learner] of [
    [0, A, B],
    [1, B, A],
  ]) {
    const owned = await ctx.paths.addPlan(
      user(teacher),
      path.id,
      plan(counts[index]),
    );
    await ctx.paths.confirmPlan(user(learner), owned.id, 1);
    plans.push({ owned, teacher, index });
  }
  await ctx.paths.confirmAgreement(user(A), path.id, 1);
  await ctx.paths.confirmAgreement(user(B), path.id, 1);
  for (const { owned, teacher, index } of plans) {
    const start = Date.parse(
      index ? "2027-01-10T10:00:00Z" : "2026-11-10T10:00:00Z",
    );
    const schedule = await ctx.schedules.createProposal(
      user(teacher),
      owned.id,
      {
        expectedPlanVersion: 1,
        items: Array.from({ length: counts[index] }, (_, i) => ({
          sessionNo: i + 1,
          startAt: new Date(start + i * 7 * 86400000).toISOString(),
          endAt: new Date(start + i * 7 * 86400000 + 3600000).toISOString(),
        })),
      },
    );
    await ctx.schedules.confirmProposal(user(A), schedule.id, 1);
    await ctx.schedules.confirmProposal(user(B), schedule.id, 1);
  }
  await finalizeAs(ctx, A, path.id);
  const audit = new AuditWriter(new AuditRepository());
  const state = new LearningChangeState(audit, ctx.configuration);
  const changes = new SessionChangesService(runner(ctx.db), state);
  const provenance = { requireTracked: async () => {}, settle: async () => {} };
  const ledger = new PathTerminationLedgerService(
    new CreditOperationsService(provenance),
    provenance,
  );
  const stop = new PathTerminationService(
    runner(ctx.db),
    state,
    changes,
    ledger,
    ctx.requests,
    ctx.requestPaths,
  );
  return { ...ctx, path, stop, state, changes };
}

async function consent(ctx) {
  const request = await ctx.stop.request(
    user(A),
    ctx.path.id,
    randomUUID(),
    "Agree to end the learning agreement",
  );
  const result = await ctx.stop.respond(user(B), ctx.path.id, request.id, {
    expectedVersion: 1,
    accept: true,
  });
  return { request, result };
}

function absent(ctx, both = false) {
  const session = ctx.db.rows("session").find((row) => row.teacherId === A);
  ctx.clock.now = new Date(+session.endAt + 49 * 3600000);
  session.status = "MAKEUP_REQUIRED";
  session.makeupDeadlineAt = new Date(+ctx.clock.now + 86400000);
  ctx.db.seed("sessionAttendanceOutcome", {
    id: randomUUID(),
    sessionId: session.id,
    occurrenceStartAt: session.startAt,
    occurrenceEndAt: session.endAt,
    teacherVerdict: "ABSENT",
    learnerVerdict: both ? "ABSENT" : "PRESENT",
    attendanceCase: both ? "BOTH_ABSENT" : "TEACHER_ABSENT",
    status: "FINAL",
    finalizedAt: ctx.clock.now,
    resolution: "MAKEUP_REQUIRED",
    determinedAt: ctx.clock.now,
    finalizesAt: ctx.clock.now,
    evidence: {},
  });
  return session;
}

test("4% is charged on both original Holds even before any lesson; bilateral consent posts once", async () => {
  const ctx = await fixture();
  const quote = await ctx.stop.quote(user(A), ctx.path.id);
  assert.equal(
    quote.allocations.reduce((sum, item) => sum + Number(item.platformFee), 0),
    8,
  );
  assert.deepEqual(
    quote.allocations.map((item) => item.refund),
    ["96.00", "96.00"],
  );
  for (const item of quote.allocations) {
    const own = item.sessionCredits.filter(
      (row) => row.teacherId === item.userId,
    );
    assert.equal(own.length, item.userId === A ? 5 : 3);
    assert.equal(
      own.reduce((sum, row) => sum + Math.round(Number(row.credit) * 100), 0),
      10000,
    );
    assert.ok(
      item.sessionCredits
        .filter((row) => row.teacherId !== item.userId)
        .every((row) => row.credit === "0.00"),
    );
  }
  const { request, result } = await consent(ctx);
  assert.equal(result.status, "APPLIED");
  const replay = await ctx.stop.respond(user(B), ctx.path.id, request.id, {
    expectedVersion: 1,
    accept: true,
  });
  assert.equal(replay.operationId, result.operationId);
  assert.equal(
    ctx.db
      .rows("creditOperation")
      .filter((row) => row.operationType === "PATH_TERMINATION").length,
    1,
  );
  assert.ok(ctx.db.rows("creditWallet").every((row) => row.heldCredit === 0n));
});

test("teacher-only absence compensates the partner using its own plan denominator", async () => {
  const ctx = await fixture();
  absent(ctx);
  const quote = await ctx.stop.quote(user(A), ctx.path.id);
  const owner = quote.allocations.find((row) => row.userId === A);
  assert.equal(owner.counterpartyPayment, "20.00");
  assert.equal(owner.refund, "76.00");
  assert.equal(owner.platformFee, "4.00");
  await consent(ctx);
  assert.equal(
    ctx.db.rows("creditWallet").find((row) => row.userId === A).availableCredit,
    17600n,
  );
  assert.equal(
    ctx.db.rows("creditWallet").find((row) => row.userId === B).availableCredit,
    21600n,
  );
});

test("both absent means no compensation; completed makeup removes the original absence", async () => {
  const ctx = await fixture();
  const session = absent(ctx, true);
  let quote = await ctx.stop.quote(user(A), ctx.path.id);
  assert.ok(
    quote.allocations.every((row) => row.compensationCredit === "0.00"),
  );
  const old = ctx.db.rows("sessionAttendanceOutcome")[0];
  old.learnerVerdict = "PRESENT";
  session.startAt = new Date(+session.startAt + 3 * 86400000);
  session.endAt = new Date(+session.endAt + 3 * 86400000);
  session.status = "COMPLETED";
  ctx.db.seed("sessionAttendanceOutcome", {
    ...old,
    id: randomUUID(),
    occurrenceStartAt: session.startAt,
    teacherVerdict: "PRESENT",
    learnerVerdict: "PRESENT",
    attendanceCase: "BOTH_PRESENT",
  });
  quote = await ctx.stop.quote(user(A), ctx.path.id);
  assert.ok(
    quote.allocations.every((row) => row.compensationCredit === "0.00"),
  );
});

test("compensation is capped at Held after fees and never creates debt", async () => {
  const ctx = await fixture([1, 1]);
  absent(ctx);
  const quote = await ctx.stop.quote(user(A), ctx.path.id);
  const owner = quote.allocations.find((row) => row.userId === A);
  assert.equal(owner.requestedCompensationCredit, "100.00");
  assert.equal(owner.compensationCredit, "96.00");
  assert.equal(owner.refund, "0.00");
  await consent(ctx);
  assert.equal(
    ctx.db.rows("creditWallet").find((row) => row.userId === A).availableCredit,
    10000n,
  );
});

test("approval keeps an ongoing lesson, cancels future lessons and settles automatically after its result", async () => {
  const ctx = await fixture();
  const session = ctx.db.rows("session").find((row) => row.teacherId === A);
  ctx.clock.now = new Date(+session.startAt + 30 * 60000);
  session.status = "ONGOING";
  const { result } = await consent(ctx);
  assert.equal(result.status, "ACCEPTED");
  assert.equal(session.status, "ONGOING");
  assert.ok(
    ctx.db
      .rows("session")
      .filter((row) => row.id !== session.id)
      .every((row) => row.status === "CANCELLED"),
  );
  ctx.clock.now = new Date(+result.expiresAt + 86400000);
  await ctx.state.expire(ctx.db, ctx.path.id, ctx.clock.now);
  assert.equal(ctx.db.rows("learningChangeRequest")[0].status, "ACCEPTED");
  session.status = "COMPLETED";
  assert.equal(
    (await ctx.stop.recoverApproved(ctx.path.id, result.id)).status,
    "APPLIED",
  );
  assert.equal(
    ctx.db
      .rows("creditTransaction")
      .filter((row) => row.type === "PLATFORM_FEE")
      .reduce((sum, row) => sum + row.amount, 0n),
    800n,
  );
});

test("Staff approves the server formula without general credit adjustment powers", async () => {
  const ctx = await fixture();
  const request = await ctx.stop.request(
    user(A),
    ctx.path.id,
    "staff",
    "Please review ending this agreement",
  );
  const escalated = await ctx.stop.respond(user(B), ctx.path.id, request.id, {
    expectedVersion: 1,
    accept: false,
  });
  const review = await ctx.stop.review(staff, ctx.path.id, request.id);
  const input = {
    expectedVersion: escalated.version,
    expectedExecutionDigest: review.execution.digest,
    reason: "Termination is justified by the evidence",
  };
  await assert.rejects(
    async () =>
      ctx.stop.execute(
        { ...staff, permissions: ["report:moderate"] },
        ctx.path.id,
        request.id,
        input,
      ),
    /TERMINATION_REVIEW_PERMISSION_REQUIRED/,
  );
  await assert.rejects(
    () =>
      ctx.stop.execute(staff, ctx.path.id, request.id, {
        ...input,
        allocations: review.execution.quote.allocations.map((row) => ({
          ...row,
          refund: "0.00",
        })),
      }),
    /TERMINATION_FORMULA_MISMATCH/,
  );
  const allocation = review.execution.quote.allocations[0];
  await assert.rejects(
    () =>
      ctx.stop.execute(staff, ctx.path.id, request.id, {
        ...input,
        allocations: [allocation, allocation],
      }),
    /TERMINATION_FORMULA_MISMATCH/,
  );
  assert.equal(ctx.db.rows("learningPath")[0].terminationApprovedAt, null);
  assert.equal(
    (await ctx.stop.execute(staff, ctx.path.id, request.id, input)).status,
    "APPLIED",
  );
});

test("the total 4% fee is rounded once before allocating hundredths to the two Holds", () => {
  const fees = allocateHeldFee([
    { userId: A, amount: 10013n },
    { userId: B, amount: 10013n },
  ]);
  assert.equal(fees.get(A) + fees.get(B), 801n);
  assert.equal(fees.get(A), 401n);
  assert.equal(fees.get(B), 400n);
});

test("ordinary completed settlement uses the same total Held rounding as termination", async () => {
  const ctx = await fixture([5, 3], "100.13");
  const row = ctx.db.rows("learningPath")[0];
  row.status = "ACTIVE";
  const sessions = ctx.db.rows("session");
  for (const session of sessions) session.status = "COMPLETED";
  ctx.clock.now = new Date(
    Math.max(...sessions.map((session) => +session.endAt)) + 49 * 3600000,
  );
  const result = await ctx.sessions.settlePath(user(A), ctx.path.id);
  assert.equal(result.fee, "8.01");
  assert.equal(
    ctx.db
      .rows("creditWallet")
      .reduce((sum, wallet) => sum + wallet.availableCredit, 0n),
    39199n,
  );
});

test("finalizing an in-flight absence after approval creates no new makeup and recovery posts its compensation", async () => {
  const ctx = await fixture();
  const session = ctx.db.rows("session").find((row) => row.teacherId === A);
  ctx.clock.now = new Date(+session.startAt + 30 * 60000);
  session.status = "ONGOING";
  const { result } = await consent(ctx);
  session.status = "NO_SHOW";
  ctx.db.seed("sessionAttendanceOutcome", {
    sessionId: session.id,
    occurrenceStartAt: session.startAt,
    occurrenceEndAt: session.endAt,
    teacherVerdict: "ABSENT",
    learnerVerdict: "PRESENT",
    attendanceCase: "TEACHER_ABSENT",
    status: "PROVISIONAL",
    finalizesAt: new Date(+session.endAt + 48 * 3600000),
    evidence: { policy: ctx.configuration.values["session.attendancePolicy"] },
  });
  ctx.clock.now = new Date(+session.endAt + 49 * 3600000);
  const outcomes = new SessionOutcomeService(
    runner(ctx.db),
    { applyNoShow: async () => {} },
    {},
  );
  await outcomes.finalizeDue(session.id);
  assert.equal(session.status, "CANCELLED");
  assert.equal(session.makeupCount, 0);
  const recovery = new PathTerminationRecoveryWorker(ctx.db, ctx.stop);
  await recovery.sweep();
  recovery.onModuleDestroy();
  const final = ctx.db
    .rows("learningChangeRequest")
    .find((row) => row.id === result.id);
  assert.equal(final.status, "APPLIED");
  assert.equal(
    ctx.db.rows("creditWallet").find((row) => row.userId === A).availableCredit,
    17600n,
  );
});

test("historical agreement snapshots are blocked for policy review without rewriting them", async () => {
  const ctx = await fixture();
  const hold = ctx.db.rows("heldCreditAllocation")[0];
  hold.sessionCreditSnapshot.policy = "TWO_WAY_SESSION_V1";
  delete hold.sessionCreditSnapshot.ownerId;
  const before = structuredClone(hold.sessionCreditSnapshot);
  const quote = await ctx.stop.quote(user(A), ctx.path.id);
  assert.ok(
    quote.reasonCodes.includes("SESSION_CREDIT_POLICY_REVIEW_REQUIRED"),
  );
  assert.deepEqual(hold.sessionCreditSnapshot, before);
});

test("a lesson completed while a termination request is pending retains its result and original share", async () => {
  const ctx = await fixture();
  const session = ctx.db.rows("session").find((row) => row.teacherId === A);
  ctx.clock.now = new Date(+session.startAt - 30 * 60000);
  const request = await ctx.stop.request(
    user(A),
    ctx.path.id,
    "pending-lesson",
    "Discuss ending the agreement",
  );
  ctx.clock.now = new Date(+session.endAt + 30 * 60000);
  await ctx.sessions.complete(
    user(A),
    session.id,
    "Taught during the pending request",
  );
  await ctx.sessions.complete(
    user(B),
    session.id,
    "Learned during the pending request",
  );
  const result = await ctx.stop.respond(user(B), ctx.path.id, request.id, {
    expectedVersion: 1,
    accept: true,
  });
  assert.equal(result.status, "APPLIED");
  assert.equal(session.status, "COMPLETED");
  const owner = result.resolution.quote.allocations.find(
    (row) => row.userId === A,
  );
  assert.equal(owner.completedCredit, "20.00");
  assert.equal(owner.compensationCredit, "0.00");
});

test("HTTP Staff approval accepts a reason and quote digest without client-supplied money", async () => {
  const ctx = await fixture();
  const request = await ctx.stop.request(
    user(A),
    ctx.path.id,
    "http-staff",
    "Please review ending the agreement",
  );
  const pending = await ctx.stop.respond(user(B), ctx.path.id, request.id, {
    expectedVersion: 1,
    accept: false,
  });
  const review = await ctx.stop.review(staff, ctx.path.id, request.id);
  const module = await Test.createTestingModule({
    controllers: [PathTerminationController],
    providers: [
      IdentityGuard,
      { provide: PathTerminationService, useValue: ctx.stop },
      { provide: SessionsService, useValue: { principal: async () => staff } },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(0, "127.0.0.1");
  try {
    const url = `${await app.getUrl()}/api/v1/learning-paths/${ctx.path.id}/termination-requests/${request.id}/execute`;
    const body = {
      expectedVersion: pending.version,
      expectedExecutionDigest: review.execution.digest,
      reason: "Staff approves using the quoted formula",
    };
    const execute = () =>
      fetch(url, {
        method: "POST",
        headers: {
          authorization: "Bearer staff-test",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    const response = await execute();
    assert.equal(response.status, 201);
    const data = (await response.json()).data;
    assert.equal(data.status, "APPLIED");
    assert.equal(
      (await (await execute()).json()).data.operationId,
      data.operationId,
    );
    assert.ok(!staff.permissions.includes("credit:adjust"));
  } finally {
    await app.close();
  }
});
