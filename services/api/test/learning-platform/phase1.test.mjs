import assert from "node:assert/strict";
import { test } from "node:test";
import {
  A,
  B,
  C,
  confirmedTwoWay,
  conversationId,
  pathStatus,
  plan,
  httpError,
  rejectsWith,
  setup,
  slots,
  twoWayWithPlans,
  user,
} from "./fixtures.mjs";

test("SH-050: TWO_WAY takes exactly two opposite plans, each created by its teacher", async () => {
  const ctx = setup();
  const { pathId, planAB, planBA } = await twoWayWithPlans(ctx);

  assert.deepEqual(
    [planAB, planBA].map(({ teacherId, learnerId }) => [teacherId, learnerId]),
    [
      [A, B],
      [B, A],
    ],
  );
  for (const row of ctx.db.rows("learningPlan")) {
    assert.equal(row.createdByUserId, row.teacherId);
  }
  await rejectsWith(
    ctx.paths.addPlan(user(A), pathId, plan()),
    409,
    "LEARNING_PLAN_LIMIT_REACHED",
  );
  await rejectsWith(
    ctx.paths.addPlan(user(C), pathId, plan()),
    403,
    "LEARNING_PATH_ACCESS_DENIED",
  );
});

test("SH-050: a teacher cannot add a second plan in the same direction", async () => {
  const ctx = setup();
  const path = await ctx.paths.create(user(A), {
    conversationId,
    exchangeType: "TWO_WAY",
    totalCreditPerUser: "20.00",
  });
  await ctx.paths.addPlan(user(A), path.id, plan());
  await assert.rejects(
    ctx.paths.addPlan(user(A), path.id, plan()),
    httpError(409, "LEARNING_PLAN_DIRECTION_ALREADY_EXISTS"),
  );
});

test("SH-050/051: only the plan's teacher may revise it; the learner may not", async () => {
  const ctx = setup();
  const { planAB } = await twoWayWithPlans(ctx);
  await assert.rejects(
    ctx.paths.revisePlan(user(B), planAB.id, 1, plan()),
    httpError(403, "ONLY_PLAN_TEACHER_CAN_REVISE"),
  );
});

test("SH-051: only the learner confirms, and only the current plan version", async () => {
  const ctx = setup();
  const { planAB } = await twoWayWithPlans(ctx);
  await rejectsWith(
    ctx.paths.confirmPlan(user(A), planAB.id, 1),
    403,
    "ONLY_LEARNER_CAN_CONFIRM_PLAN",
  );
  await rejectsWith(
    ctx.paths.confirmPlan(user(B), planAB.id, 2),
    409,
    "STALE_LEARNING_PLAN_VERSION",
  );
  await ctx.paths.confirmPlan(user(B), planAB.id, 1);
  const version = ctx.db
    .rows("learningPlanVersion")
    .find((row) => row.planId === planAB.id && row.versionNo === 1);
  assert.ok(version.learnerConfirmedAt instanceof Date);
});

test("SH-051: the path is CONFIRMED only with every plan and both agreement confirmations", async () => {
  const ctx = setup();
  const { pathId, planAB, planBA } = await twoWayWithPlans(ctx);

  await ctx.paths.confirmAgreement(user(A), pathId, 1);
  await ctx.paths.confirmAgreement(user(B), pathId, 1);
  assert.equal(pathStatus(ctx.db, pathId), "PARTIALLY_CONFIRMED");
  await ctx.paths.confirmPlan(user(B), planAB.id, 1);
  assert.equal(pathStatus(ctx.db, pathId), "PARTIALLY_CONFIRMED");
  await ctx.paths.confirmPlan(user(A), planBA.id, 1);
  assert.equal(pathStatus(ctx.db, pathId), "CONFIRMED");
  await rejectsWith(
    ctx.paths.confirmAgreement(user(A), pathId, 2),
    409,
    "STALE_LEARNING_PATH_VERSION",
  );
});

test("SH-051: revising a plan bumps both versions and resets confirmations", async () => {
  const ctx = setup();
  const { pathId, planAB } = await twoWayWithPlans(ctx);
  await ctx.paths.confirmPlan(user(B), planAB.id, 1);
  await ctx.paths.confirmAgreement(user(A), pathId, 1);
  await ctx.paths.confirmAgreement(user(B), pathId, 1);

  const revised = await ctx.paths.revisePlan(user(A), planAB.id, 1, plan(2));

  assert.deepEqual([revised.version, revised.agreementVersion], [2, 2]);
  const planVersion = ctx.db
    .rows("learningPlanVersion")
    .find((row) => row.planId === planAB.id && row.versionNo === 2);
  assert.equal(planVersion.learnerConfirmedAt ?? null, null);
  const agreement = ctx.db
    .rows("learningPathVersion")
    .find((row) => row.pathId === pathId && row.versionNo === 2);
  assert.equal(agreement.participantAConfirmedAt ?? null, null);
  assert.equal(agreement.participantBConfirmedAt ?? null, null);
  assert.equal(pathStatus(ctx.db, pathId), "PROPOSED");
  await rejectsWith(
    ctx.paths.confirmPlan(user(B), planAB.id, 1),
    409,
    "STALE_LEARNING_PLAN_VERSION",
  );
});

test("SH-052: schedules need a CONFIRMED path and come from the plan's teacher", async () => {
  const ctx = setup();
  const { pathId, planAB } = await twoWayWithPlans(ctx);
  await ctx.paths.confirmPlan(user(B), planAB.id, 1);
  const input = {
    expectedPlanVersion: 1,
    items: slots(["2026-11-02T10:00:00Z", "2026-11-02T11:00:00Z"]),
  };
  await rejectsWith(
    ctx.schedules.createProposal(user(A), planAB.id, input),
    409,
    "LEARNING_PATH_NOT_CONFIRMED",
  );
  assert.equal(pathStatus(ctx.db, pathId), "PROPOSED");

  const confirmed = setup();
  const ids = await confirmedTwoWay(confirmed);
  await rejectsWith(
    confirmed.schedules.createProposal(user(B), ids.planAB.id, input),
    403,
    "ONLY_PLAN_TEACHER_CAN_PROPOSE_SCHEDULE",
  );
});

test("SH-052: item count follows totalSessions and duration bounds come from configuration", async () => {
  const ctx = setup({
    config: { "session.durationMinutes": { min: 90, max: 120 } },
  });
  const path = await ctx.paths.create(user(A), {
    conversationId,
    exchangeType: "ONE_WAY",
    teacherId: A,
    learnerId: B,
    negotiatedCredit: "10.00",
  });
  const onlyPlan = await ctx.paths.addPlan(user(A), path.id, plan(2));
  await ctx.paths.confirmPlan(user(B), onlyPlan.id, 1);
  await ctx.paths.confirmAgreement(user(A), path.id, 1);
  await ctx.paths.confirmAgreement(user(B), path.id, 1);
  const propose = (items) =>
    ctx.schedules.createProposal(user(A), onlyPlan.id, {
      expectedPlanVersion: 1,
      items,
    });

  await rejectsWith(
    propose(slots(["2026-11-02T10:00:00Z", "2026-11-02T11:30:00Z"])),
    400,
    "SCHEDULE_ITEM_COUNT_MISMATCH",
  );
  await rejectsWith(
    propose(
      slots(
        ["2026-11-02T10:00:00Z", "2026-11-02T11:00:00Z"],
        ["2026-11-03T10:00:00Z", "2026-11-03T11:30:00Z"],
      ),
    ),
    400,
    "INVALID_SCHEDULE_ITEMS",
  );
  await rejectsWith(
    propose(
      slots(
        ["2026-11-02T10:00:00Z", "2026-11-02T11:30:00Z"],
        ["2026-11-02T11:00:00Z", "2026-11-02T12:30:00Z"],
      ),
    ),
    400,
    "SCHEDULE_ITEMS_OVERLAP",
  );
  const created = await propose(
    slots(
      ["2026-11-02T10:00:00Z", "2026-11-02T11:30:00Z"],
      ["2026-11-03T10:00:00Z", "2026-11-03T12:00:00Z"],
    ),
  );
  assert.equal(created.status, "PROPOSED");
  assert.deepEqual(
    ctx.db
      .rows("scheduleItem")
      .map(({ planId, planVersion, sessionNo }) => [
        planId,
        planVersion,
        sessionNo,
      ]),
    [
      [onlyPlan.id, 1, 1],
      [onlyPlan.id, 1, 2],
    ],
  );
  await rejectsWith(
    propose(
      slots(
        ["2026-11-04T10:00:00Z", "2026-11-04T11:30:00Z"],
        ["2026-11-05T10:00:00Z", "2026-11-05T11:30:00Z"],
      ),
    ),
    409,
    "SCHEDULE_PROPOSAL_ALREADY_EXISTS",
  );
});

test("SH-053: both participants confirm the same schedule version", async () => {
  const ctx = setup();
  const { planAB } = await confirmedTwoWay(ctx);
  const schedule = await ctx.schedules.createProposal(user(A), planAB.id, {
    expectedPlanVersion: 1,
    items: slots(["2026-11-02T10:00:00Z", "2026-11-02T11:00:00Z"]),
  });

  const first = await ctx.schedules.confirmProposal(user(A), schedule.id, 1);
  assert.deepEqual(
    [first.status, first.bothConfirmed],
    ["PARTIALLY_CONFIRMED", false],
  );
  await rejectsWith(
    ctx.schedules.confirmProposal(user(B), schedule.id, 2),
    409,
    "STALE_SCHEDULE_VERSION",
  );
  await rejectsWith(
    ctx.schedules.confirmProposal(user(C), schedule.id, 1),
    403,
    "LEARNING_PATH_ACCESS_DENIED",
  );
  const second = await ctx.schedules.confirmProposal(user(B), schedule.id, 1);
  assert.deepEqual([second.status, second.bothConfirmed], ["PROPOSED", true]);
});

test("SH-057: ONE_WAY stores roles and a decimal(12,2) negotiated credit", async () => {
  const ctx = setup();
  const path = await ctx.paths.create(user(B), {
    conversationId,
    exchangeType: "ONE_WAY",
    teacherId: A,
    learnerId: B,
    negotiatedCredit: "150.75",
  });
  const [agreement] = ctx.db.rows("learningPathVersion");
  assert.deepEqual(
    [agreement.pathId, agreement.teacherId, agreement.learnerId],
    [path.id, A, B],
  );
  assert.equal(agreement.negotiatedCredit, 15075n);
  assert.equal(agreement.totalCreditPerUser, null);

  const oneWay = async (overrides) =>
    ctx.paths.create(user(B), {
      conversationId,
      exchangeType: "ONE_WAY",
      teacherId: A,
      learnerId: B,
      negotiatedCredit: "10.00",
      ...overrides,
    });
  await rejectsWith(
    oneWay({ negotiatedCredit: "0" }),
    400,
    "INVALID_LEARNING_AGREEMENT",
  );
  await rejectsWith(
    oneWay({ negotiatedCredit: "1.234" }),
    400,
    "INVALID_CREDIT_AMOUNT",
  );
  await rejectsWith(
    oneWay({ learnerId: A }),
    400,
    "INVALID_LEARNING_AGREEMENT",
  );
  await rejectsWith(
    oneWay({ teacherId: C }),
    400,
    "INVALID_LEARNING_AGREEMENT",
  );
});

test("SH-057: changing terms bumps the version and clears both confirmations", async () => {
  const ctx = setup();
  const { pathId } = await twoWayWithPlans(ctx);
  await ctx.paths.confirmAgreement(user(A), pathId, 1);
  await ctx.paths.confirmAgreement(user(B), pathId, 1);

  const revised = await ctx.paths.reviseAgreement(user(B), pathId, {
    expectedVersion: 1,
    exchangeType: "ONE_WAY",
    teacherId: A,
    learnerId: B,
    negotiatedCredit: "30.00",
  });

  assert.deepEqual(
    [revised.version, revised.previousExchangeType, revised.exchangeType],
    [2, "TWO_WAY", "ONE_WAY"],
  );
  const agreement = ctx.db
    .rows("learningPathVersion")
    .find((row) => row.versionNo === 2);
  assert.equal(agreement.participantAConfirmedAt ?? null, null);
  assert.equal(agreement.participantBConfirmedAt ?? null, null);
  assert.deepEqual(
    ctx.db
      .rows("pathVersionPlan")
      .filter((row) => row.pathVersion === 2)
      .map((row) =>
        ctx.db.rows("learningPlan").find((p) => p.id === row.planId),
      )
      .map(({ teacherId, learnerId }) => [teacherId, learnerId]),
    [[A, B]],
  );
  await rejectsWith(
    ctx.paths.reviseAgreement(user(A), pathId, {
      expectedVersion: 1,
      exchangeType: "TWO_WAY",
      totalCreditPerUser: "20.00",
    }),
    409,
    "STALE_LEARNING_PATH_VERSION",
  );
});

test("SH-057/058: ONE_WAY is ready to Hold with one plan and schedule; only the learner pays", async () => {
  const ctx = setup({ wallets: { [A]: 0n, [B]: 1000n } });
  const path = await ctx.paths.create(user(B), {
    conversationId,
    exchangeType: "ONE_WAY",
    teacherId: A,
    learnerId: B,
    negotiatedCredit: "10.00",
  });
  const pathId = path.id;
  await rejectsWith(
    ctx.paths.addPlan(user(B), pathId, plan()),
    403,
    "ONLY_TEACHER_CAN_CREATE_PLAN",
  );
  const { id: planId, learnerId } = await ctx.paths.addPlan(
    user(A),
    pathId,
    plan(),
  );
  assert.equal(learnerId, B);
  await rejectsWith(
    ctx.paths.addPlan(user(A), pathId, plan()),
    409,
    "LEARNING_PLAN_LIMIT_REACHED",
  );
  await rejectsWith(
    ctx.paths.revisePlan(user(B), planId, 1, plan()),
    403,
    "ONLY_PLAN_TEACHER_CAN_REVISE",
  );
  await ctx.paths.confirmPlan(user(B), planId, 1);
  await ctx.paths.confirmAgreement(user(A), pathId, 1);
  await ctx.paths.confirmAgreement(user(B), pathId, 1);
  assert.equal(pathStatus(ctx.db, pathId), "CONFIRMED");

  await rejectsWith(
    ctx.schedules.createProposal(user(B), planId, {
      expectedPlanVersion: 1,
      items: slots(["2026-11-02T10:00:00Z", "2026-11-02T11:00:00Z"]),
    }),
    403,
    "ONLY_PLAN_TEACHER_CAN_PROPOSE_SCHEDULE",
  );
  const schedule = await ctx.schedules.createProposal(user(A), planId, {
    expectedPlanVersion: 1,
    items: slots(["2026-11-02T10:00:00Z", "2026-11-02T11:00:00Z"]),
  });
  await rejectsWith(
    ctx.paths.validateForFinalize(user(A), pathId),
    409,
    "SCHEDULE_NOT_CONFIRMED",
  );
  await ctx.schedules.confirmProposal(user(A), schedule.id, 1);
  await assert.rejects(
    ctx.paths.validateForFinalize(user(A), pathId),
    (error) => error.getStatus() === 409,
  );
  await ctx.schedules.confirmProposal(user(B), schedule.id, 1);

  const ready = await ctx.paths.validateForFinalize(user(A), pathId);

  assert.deepEqual(
    [ready.exchangeType, ready.planCount, ready.scheduleCount, ready.ready],
    ["ONE_WAY", 1, 1, true],
  );
});

test("SH-054/057: TWO_WAY checks both payers and needs 20 credit each", async () => {
  const twoWay = setup({ wallets: { [A]: 5000n, [B]: 1999n } });
  const { pathId, planAB, planBA } = await confirmedTwoWay(twoWay);
  for (const [teacher, planId, day] of [
    [A, planAB.id, "02"],
    [B, planBA.id, "03"],
  ]) {
    const schedule = await twoWay.schedules.createProposal(
      user(teacher),
      planId,
      {
        expectedPlanVersion: 1,
        items: slots([`2026-11-${day}T10:00:00Z`, `2026-11-${day}T11:00:00Z`]),
      },
    );
    await twoWay.schedules.confirmProposal(user(A), schedule.id, 1);
    await twoWay.schedules.confirmProposal(user(B), schedule.id, 1);
  }
  await rejectsWith(
    twoWay.paths.validateForFinalize(user(A), pathId),
    409,
    "INSUFFICIENT_AVAILABLE_CREDIT",
  );
  twoWay.db
    .rows("creditWallet")
    .find((row) => row.userId === B).availableCredit = 2000n;
  const ready = await twoWay.paths.validateForFinalize(user(B), pathId);
  assert.equal(ready.ready, true);
});
