import assert from "node:assert/strict";
import { test } from "node:test";
import {
  A,
  B,
  C,
  completedOneWay,
  confirmedTwoWay,
  finalizeAs,
  finalizedOneWay,
  pathRow,
  pathStatus,
  rejectsWith,
  scheduledOneWay,
  scheduledTwoWay,
  setup,
  slots,
  user,
  wallet,
} from "./fixtures.mjs";

function assertNothingLocked(db, pathId) {
  assert.equal(pathStatus(db, pathId), "CONFIRMED");
  assert.equal(pathRow(db, pathId).lockedVersion, null);
  assert.equal(db.rows("session").filter((s) => s.pathId === pathId).length, 0);
  assert.equal(db.rows("heldCreditAllocation").length, 0);
  assert.equal(db.rows("creditOperation").length, 0);
  assert.ok(
    db.rows("scheduleProposal").every((row) => row.status !== "LOCKED"),
  );
}

test("SH-054: a partially confirmed schedule blocks finalize as SCHEDULE_NOT_CONFIRMED", async () => {
  const ctx = setup({ wallets: { [A]: 5000n, [B]: 5000n } });
  const { pathId, planAB, planBA } = await confirmedTwoWay(ctx);
  for (const [teacher, planId, day] of [
    [A, planAB.id, "02"],
    [B, planBA.id, "03"],
  ]) {
    const schedule = await ctx.schedules.createProposal(user(teacher), planId, {
      expectedPlanVersion: 1,
      items: slots([`2026-11-${day}T10:00:00Z`, `2026-11-${day}T11:00:00Z`]),
    });
    await ctx.schedules.confirmProposal(user(A), schedule.id, 1);
    if (teacher === A)
      await ctx.schedules.confirmProposal(user(B), schedule.id, 1);
  }

  await rejectsWith(finalizeAs(ctx, A, pathId), 409, "SCHEDULE_NOT_CONFIRMED");
  assertNothingLocked(ctx.db, pathId);
});

test("SH-054: rights, conflicts, balance, duration and the 20 Credit minimum are all enforced", async () => {
  const outsider = setup({ wallets: { [A]: 5000n, [B]: 5000n } });
  const first = await scheduledTwoWay(outsider);
  await rejectsWith(
    finalizeAs(outsider, C, first.pathId),
    403,
    "LEARNING_PATH_ACCESS_DENIED",
  );
  assertNothingLocked(outsider.db, first.pathId);

  const conflict = setup({ wallets: { [A]: 5000n, [B]: 5000n } });
  const second = await scheduledTwoWay(conflict);
  conflict.db.seed("session", {
    pathId: "another-path",
    planId: "another-plan",
    planVersion: 1,
    outlineSessionNo: 1,
    teacherId: A,
    learnerId: C,
    startAt: new Date("2026-11-02T10:30:00Z"),
    endAt: new Date("2026-11-02T11:30:00Z"),
    status: "CONFIRMED",
  });
  await rejectsWith(
    finalizeAs(conflict, A, second.pathId),
    409,
    "SCHEDULE_CONFLICT",
  );
  assertNothingLocked(conflict.db, second.pathId);

  const poor = setup({ wallets: { [A]: 5000n, [B]: 1999n } });
  const third = await scheduledTwoWay(poor);
  await rejectsWith(
    finalizeAs(poor, A, third.pathId),
    409,
    "INSUFFICIENT_AVAILABLE_CREDIT",
  );
  assertNothingLocked(poor.db, third.pathId);

  const strict = setup({ wallets: { [A]: 5000n, [B]: 5000n } });
  const fourth = await scheduledTwoWay(strict);
  strict.configuration.values["session.durationMinutes"] = {
    min: 90,
    max: 180,
  };
  await rejectsWith(
    finalizeAs(strict, A, fourth.pathId),
    409,
    "INVALID_SCHEDULE_ITEMS",
  );
  assertNothingLocked(strict.db, fourth.pathId);

  const small = setup({ wallets: { [A]: 5000n, [B]: 5000n } });
  const fifth = await scheduledTwoWay(small, "19.99");
  await rejectsWith(
    finalizeAs(small, A, fifth.pathId),
    409,
    "INVALID_TWO_WAY_AGREEMENT",
  );
  assertNothingLocked(small.db, fifth.pathId);
});

test("SH-055: TWO_WAY finalize holds both commitments, locks schedules and creates plan sessions", async () => {
  const ctx = setup({ wallets: { [A]: 5000n, [B]: 5000n } });
  const { pathId, planAB, planBA } = await scheduledTwoWay(ctx);

  const result = await finalizeAs(ctx, B, pathId);

  assert.equal(result.status, "SCHEDULED");
  assert.deepEqual(
    [A, B].map((id) => [
      wallet(ctx.db, id).availableCredit,
      wallet(ctx.db, id).heldCredit,
    ]),
    [
      [3000n, 2000n],
      [3000n, 2000n],
    ],
  );
  assert.deepEqual(
    ctx.db
      .rows("heldCreditAllocation")
      .map(({ userId, purpose, beneficiaryId, amount }) => [
        userId,
        purpose,
        beneficiaryId,
        amount,
      ])
      .sort(([left], [right]) => left.localeCompare(right)),
    [
      [A, "COMMITMENT", null, 2000n],
      [B, "COMMITMENT", null, 2000n],
    ],
  );
  const sessions = ctx.db.rows("session");
  assert.deepEqual(
    sessions
      .map(({ pathId: sessionPath, planId, teacherId, learnerId }) => [
        sessionPath,
        planId,
        teacherId,
        learnerId,
      ])
      .sort(([, left], [, right]) => left.localeCompare(right)),
    [
      [pathId, planAB.id, A, B],
      [pathId, planBA.id, B, A],
    ].sort(([, left], [, right]) => left.localeCompare(right)),
  );
  assert.ok(
    ctx.db
      .rows("scheduleProposal")
      .every((row) => row.status === "LOCKED" && row.appliedVersion === 1),
  );
  assert.deepEqual(
    [pathStatus(ctx.db, pathId), pathRow(ctx.db, pathId).lockedVersion],
    ["SCHEDULED", 1],
  );
  const agreement = ctx.db.rows("learningPathVersion")[0];
  assert.deepEqual(
    [agreement.feeRateSnapshot, agreement.feeAmountSnapshot],
    ["0.04", 160n],
  );
  assert.equal(
    ctx.db.rows("outboxEvent").filter((e) => e.type === "learning-path.locked")
      .length,
    1,
  );
});

test("SH-055/059: ONE_WAY finalize holds only the learner; the teacher holds nothing", async () => {
  const ctx = setup({ wallets: { [A]: 0n, [B]: 10000n } });
  const { pathId } = await scheduledOneWay(ctx);

  await finalizeAs(ctx, A, pathId);

  assert.deepEqual(
    [wallet(ctx.db, B).availableCredit, wallet(ctx.db, B).heldCredit],
    [0n, 10000n],
  );
  assert.deepEqual(
    [wallet(ctx.db, A).availableCredit, wallet(ctx.db, A).heldCredit],
    [0n, 0n],
  );
  const [allocation] = ctx.db.rows("heldCreditAllocation");
  assert.deepEqual(
    [allocation.userId, allocation.purpose, allocation.beneficiaryId],
    [B, "TEACHING_PAYMENT", A],
  );
});

test("SH-055: finalize never holds twice, whatever the idempotency key", async () => {
  const ctx = setup({ wallets: { [A]: 0n, [B]: 10000n } });
  const { pathId } = await scheduledOneWay(ctx);

  const first = await finalizeAs(ctx, A, pathId, "key-1");
  const replay = await finalizeAs(ctx, A, pathId, "key-1");
  const otherKey = await finalizeAs(ctx, B, pathId, "key-2");

  for (const result of [replay, otherKey]) {
    assert.equal(result.status, "SCHEDULED");
    assert.deepEqual(
      result.sessions.map(({ id }) => id),
      first.sessions.map(({ id }) => id),
    );
  }
  assert.equal(ctx.db.rows("creditOperation").length, 1);
  assert.equal(ctx.db.rows("heldCreditAllocation").length, 1);
  assert.equal(ctx.db.rows("session").length, 1);
  assert.equal(wallet(ctx.db, B).heldCredit, 10000n);
});

test("SH-056: a reschedule applies only after both confirm; until then the old time stands", async () => {
  const ctx = setup({ wallets: { [B]: 10000n } });
  const { scheduleId, session } = await finalizedOneWay(ctx);
  const originalStart = session.startAt.getTime();

  const proposal = await ctx.schedules.proposeReschedule(user(B), session.id, {
    expectedVersion: 1,
    startAt: "2026-11-04T10:00:00Z",
    endAt: "2026-11-04T11:00:00Z",
  });
  assert.deepEqual([proposal.version, proposal.status], [2, "NEEDS_REVISION"]);
  await ctx.schedules.confirmProposal(user(A), scheduleId, 2);
  assert.equal(ctx.db.rows("session")[0].startAt.getTime(), originalStart);

  const applied = await ctx.schedules.confirmProposal(user(B), scheduleId, 2);

  assert.equal(applied.status, "LOCKED");
  assert.equal(
    ctx.db.rows("session")[0].startAt.toISOString(),
    "2026-11-04T10:00:00.000Z",
  );
  assert.equal(
    ctx.db
      .rows("auditLog")
      .filter((row) => row.action === "SCHEDULE_RESCHEDULE").length,
    1,
  );
});

test("SH-056: the reschedule cutoff comes from configuration and keeps the old time when missed", async () => {
  const ctx = setup({ wallets: { [B]: 10000n } });
  const { scheduleId, session } = await finalizedOneWay(ctx);
  ctx.clock.now = new Date("2026-11-02T08:30:00Z"); // 90 minutes before the session
  const move = {
    expectedVersion: 1,
    startAt: "2026-11-04T10:00:00Z",
    endAt: "2026-11-04T11:00:00Z",
  };

  ctx.configuration.values["schedule.rescheduleCutoffMinutes"] = 120;
  await rejectsWith(
    ctx.schedules.proposeReschedule(user(B), session.id, move),
    409,
    "RESCHEDULE_CUTOFF_VIOLATION",
  );

  ctx.configuration.values["schedule.rescheduleCutoffMinutes"] = 60;
  await ctx.schedules.proposeReschedule(user(B), session.id, move);
  await ctx.schedules.confirmProposal(user(A), scheduleId, 2);
  ctx.clock.now = new Date("2026-11-02T09:30:00Z"); // now inside the cutoff
  await rejectsWith(
    ctx.schedules.confirmProposal(user(B), scheduleId, 2),
    409,
    "RESCHEDULE_CUTOFF_OR_STATE_VIOLATION",
  );
  assert.equal(
    ctx.db.rows("session")[0].startAt.toISOString(),
    "2026-11-02T10:00:00.000Z",
  );
});

test("SH-059: ONE_WAY 100 Credit settles 96 to the teacher and 4 as fee, exactly once", async () => {
  const ctx = setup({ wallets: { [A]: 0n, [B]: 10000n } });
  const { pathId } = await completedOneWay(ctx);
  assert.equal(pathStatus(ctx.db, pathId), "ACTIVE");
  ctx.clock.now = new Date("2026-11-05T00:00:00Z"); // after the dispute window

  const settled = await ctx.sessions.settlePath(user(B), pathId);

  assert.deepEqual([settled.gross, settled.fee], ["100.00", "4.00"]);
  assert.deepEqual(
    [wallet(ctx.db, B).availableCredit, wallet(ctx.db, B).heldCredit],
    [0n, 0n],
  );
  assert.equal(wallet(ctx.db, A).availableCredit, 9600n);
  assert.deepEqual(
    ctx.db
      .rows("creditTransaction")
      .filter((row) => row.type !== "HOLD")
      .map(({ type, amount }) => [type, amount]),
    [
      ["TEACHING_PAYMENT", 9600n],
      ["TEACHING_EARNING", 9600n],
      ["PLATFORM_FEE", 400n],
    ],
  );

  const retry = await ctx.sessions.settlePath(user(A), pathId);
  assert.equal(retry.operationId, settled.operationId);
  assert.equal(wallet(ctx.db, A).availableCredit, 9600n);
  assert.equal(ctx.db.rows("creditTransaction").length, 4);
});

test("SH-059: settlement never runs early or while a dispute blocks it", async () => {
  const early = setup({ wallets: { [B]: 10000n } });
  const scheduled = await finalizedOneWay(early);
  await rejectsWith(
    early.sessions.settlePath(user(B), scheduled.pathId),
    409,
    "LEARNING_PATH_NOT_SETTLEABLE",
  );

  const waiting = setup({ wallets: { [B]: 10000n } });
  const completed = await completedOneWay(waiting);
  await rejectsWith(
    waiting.sessions.settlePath(user(B), completed.pathId),
    409,
    "DISPUTE_WINDOW_OPEN",
  );

  const disputed = setup({ wallets: { [B]: 10000n } });
  const blocked = await completedOneWay(disputed);
  disputed.clock.now = new Date("2026-11-05T00:00:00Z");
  disputed.db.seed("reportCase", {
    reporterId: B,
    targetType: "SESSION",
    targetId: blocked.session.id,
    relatedPathId: blocked.pathId,
    reasonCode: "NO_SHOW_LATE",
    description: "Teacher did not join",
    status: "OPEN",
    blocksSettlement: true,
  });
  await rejectsWith(
    disputed.sessions.settlePath(user(B), blocked.pathId),
    409,
    "SETTLEMENT_BLOCKED_BY_DISPUTE",
  );
  for (const ctx of [early, waiting, disputed]) {
    assert.equal(wallet(ctx.db, A).availableCredit, 0n);
    assert.equal(wallet(ctx.db, B).heldCredit, 10000n);
  }
});

test("SH-057: terms stay editable after CONFIRMED until lock; old schedules stop counting", async () => {
  const ctx = setup({ wallets: { [A]: 5000n, [B]: 5000n } });
  const { pathId, planAB } = await scheduledTwoWay(ctx);
  assert.equal(pathStatus(ctx.db, pathId), "CONFIRMED");

  const revised = await ctx.paths.reviseAgreement(user(A), pathId, {
    expectedVersion: 1,
    exchangeType: "TWO_WAY",
    totalCreditPerUser: "25.00",
  });
  assert.equal(revised.version, 2);
  // Plans keep their confirmed versions; only the common terms need re-confirmation.
  assert.equal(pathStatus(ctx.db, pathId), "PARTIALLY_CONFIRMED");
  await ctx.paths.confirmAgreement(user(A), pathId, 2);
  await ctx.paths.confirmAgreement(user(B), pathId, 2);
  assert.equal(pathStatus(ctx.db, pathId), "CONFIRMED");
  await rejectsWith(
    finalizeAs(ctx, A, pathId),
    409,
    "REQUIRED_SCHEDULE_PROPOSAL_MISSING",
  );
  const rescheduled = await ctx.schedules.createProposal(user(A), planAB.id, {
    expectedPlanVersion: 1,
    items: slots(["2026-11-06T10:00:00Z", "2026-11-06T11:00:00Z"]),
  });
  assert.equal(rescheduled.version, 1);
  assertNothingLocked(ctx.db, pathId);

  const locked = setup({ wallets: { [A]: 5000n, [B]: 5000n } });
  const done = await scheduledTwoWay(locked);
  await finalizeAs(locked, A, done.pathId);
  await rejectsWith(
    locked.paths.reviseAgreement(user(A), done.pathId, {
      expectedVersion: 1,
      exchangeType: "TWO_WAY",
      totalCreditPerUser: "25.00",
    }),
    409,
    "LEARNING_PATH_NOT_EDITABLE",
  );
});
