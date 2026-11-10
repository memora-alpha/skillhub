import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { LearningPathsController } from "../../dist/modules/learning-paths/presentation/http/learning-paths.controller.js";
import { LearningPathsService } from "../../dist/modules/learning-paths/application/services/learning-paths.service.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";
import { invalidScheduleDetails } from "../../dist/shared/http/invalid-schedule-details.js";
import {
  A,
  B,
  C,
  conversationId,
  finalizeAs,
  pathRow,
  plan,
  rejectsWith,
  scheduledOneWay,
  setup,
  slots,
  user,
  wallet,
} from "./fixtures.mjs";

async function twoWay() {
  const ctx = setup({ wallets: { [A]: 5000n, [B]: 5000n } });
  const path = await ctx.paths.create(user(A), {
    conversationId,
    exchangeType: "TWO_WAY",
    totalCreditPerUser: "20.00",
  });
  const ab = await ctx.paths.addPlan(user(A), path.id, plan(2));
  const ba = await ctx.paths.addPlan(user(B), path.id, plan(2));
  await ctx.paths.confirmPlan(user(B), ab.id, 1);
  await ctx.paths.confirmPlan(user(A), ba.id, 1);
  await ctx.paths.confirmAgreement(user(A), path.id, 1);
  await ctx.paths.confirmAgreement(user(B), path.id, 1);
  for (const [teacher, planId, day] of [
    [A, ab.id, "02"],
    [B, ba.id, "03"],
  ]) {
    const schedule = await ctx.schedules.createProposal(user(teacher), planId, {
      expectedPlanVersion: 1,
      items: slots(
        [`2026-11-${day}T10:00:00Z`, `2026-11-${day}T11:00:00Z`],
        [`2026-11-${day}T12:00:00Z`, `2026-11-${day}T13:00:00Z`],
      ),
    });
    await ctx.schedules.confirmProposal(user(A), schedule.id, 1);
    await ctx.schedules.confirmProposal(user(B), schedule.id, 1);
  }
  return {
    ...ctx,
    pathId: path.id,
    ab,
    ba,
    communicationCounts: {
      outboxEvent: ctx.db.rows("outboxEvent").length,
      chatPublication: ctx.db.rows("chatPublication").length,
    },
  };
}

function itemFor(ctx, planId, sessionNo) {
  return ctx.db
    .rows("scheduleItem")
    .find((i) => i.planId === planId && i.sessionNo === sessionNo);
}

function expiredSecondSession(ctx) {
  const item = itemFor(ctx, ctx.ba.id, 2);
  item.startAt = new Date("2026-10-19T10:00:00Z");
  item.endAt = new Date("2026-10-19T11:00:00Z");
  return {
    scheduleId: item.scheduleProposalId,
    scheduleVersion: 1,
    planId: ctx.ba.id,
    planVersion: 1,
    teacherId: B,
    learnerId: A,
    sessionNo: 2,
    startAt: item.startAt.toISOString(),
    endAt: item.endAt.toISOString(),
    reasons: ["START_NOT_IN_FUTURE"],
  };
}

function assertNoLock(ctx) {
  assert.equal(pathRow(ctx.db, ctx.pathId).status, "CONFIRMED");
  assert.equal(pathRow(ctx.db, ctx.pathId).lockedVersion, null);
  for (const model of ["session", "heldCreditAllocation", "creditOperation"])
    assert.equal(ctx.db.rows(model).length, 0, model);
  for (const [model, count] of Object.entries(ctx.communicationCounts))
    assert.equal(
      ctx.db.rows(model).length,
      count,
      `${model}: no new communication on invalid schedule`,
    );
  assert.equal(wallet(ctx.db, A).availableCredit, 5000n);
  assert.equal(wallet(ctx.db, B).availableCredit, 5000n);
  assert.ok(
    ctx.db.rows("scheduleProposal").every((p) => p.status !== "LOCKED"),
  );
}

test("invalid schedule identifies only B→A session 2 on validation and finalize, without writes", async () => {
  const ctx = await twoWay();
  const invalid = expiredSecondSession(ctx);
  for (const call of [
    () => ctx.paths.validateForFinalize(user(A), ctx.pathId),
    () => finalizeAs(ctx, B, ctx.pathId),
  ]) {
    await assert.rejects(call(), (error) => {
      assert.equal(error.getStatus(), 409);
      assert.deepEqual(error.getResponse(), {
        message: "INVALID_SCHEDULE_ITEMS",
        invalidItems: [invalid],
        evaluatedAt: ctx.clock.now.toISOString(),
        durationMinutes: { min: 60, max: 180 },
      });
      return true;
    });
    assertNoLock(ctx);
  }
  await rejectsWith(
    ctx.paths.validateForFinalize(user(C), ctx.pathId),
    403,
    "LEARNING_PATH_ACCESS_DENIED",
  );
  await rejectsWith(
    finalizeAs(ctx, C, ctx.pathId, "outsider"),
    403,
    "LEARNING_PATH_ACCESS_DENIED",
  );
});

test("reports all invalid directions and reasons using effective duration limits and database time", async () => {
  const ctx = await twoWay();
  ctx.configuration.values["session.durationMinutes"] = { min: 90, max: 120 };
  const a1 = itemFor(ctx, ctx.ab.id, 1);
  a1.startAt = ctx.clock.now;
  a1.endAt = new Date(ctx.clock.now.getTime() + 60 * 60_000);
  const a2 = itemFor(ctx, ctx.ab.id, 2);
  a2.endAt = new Date(a2.startAt.getTime() + 121 * 60_000);
  const b1 = itemFor(ctx, ctx.ba.id, 1);
  b1.endAt = b1.startAt;
  const b2 = itemFor(ctx, ctx.ba.id, 2);
  b2.endAt = new Date(b2.startAt.getTime() - 60_000);
  await assert.rejects(
    ctx.paths.validateForFinalize(user(A), ctx.pathId),
    (error) => {
      const detail = error.getResponse();
      assert.deepEqual(detail.durationMinutes, { min: 90, max: 120 });
      assert.equal(detail.evaluatedAt, ctx.clock.now.toISOString());
      assert.deepEqual(
        detail.invalidItems.map((i) => [
          i.teacherId,
          i.learnerId,
          i.sessionNo,
          i.reasons,
        ]),
        [
          [A, B, 1, ["START_NOT_IN_FUTURE", "DURATION_TOO_SHORT"]],
          [A, B, 2, ["DURATION_TOO_LONG"]],
          [B, A, 1, ["END_NOT_AFTER_START"]],
          [B, A, 2, ["END_NOT_AFTER_START"]],
        ],
      );
      return true;
    },
  );
  assertNoLock(ctx);
});

test("ONE_WAY accepts exact duration boundaries and future start, but rejects start equal to database time", async () => {
  for (const minutes of [60, 180]) {
    const ctx = setup({ wallets: { [B]: 20000n } });
    const { pathId, planId } = await scheduledOneWay(ctx);
    const item = itemFor(ctx, planId, 1);
    item.startAt = new Date(ctx.clock.now.getTime() + 1);
    item.endAt = new Date(item.startAt.getTime() + minutes * 60_000);
    await ctx.paths.validateForFinalize(user(B), pathId);
    ctx.clock.now = item.startAt;
    await assert.rejects(
      ctx.paths.validateForFinalize(user(B), pathId),
      (error) => {
        assert.deepEqual(error.getResponse().invalidItems[0].reasons, [
          "START_NOT_IN_FUTURE",
        ]);
        assert.equal(error.getResponse().invalidItems[0].teacherId, A);
        return true;
      },
    );
    ctx.clock.now = new Date(item.startAt.getTime() - 1);
    assert.equal((await finalizeAs(ctx, B, pathId)).status, "SCHEDULED");
  }
});

test("invalid history is excluded; current revised schedule version is identified", async () => {
  const ctx = setup({ wallets: { [B]: 20000n } });
  const { pathId, planId, scheduleId } = await scheduledOneWay(ctx);
  const historical = itemFor(ctx, planId, 1);
  await ctx.schedules.reviseProposal(user(A), scheduleId, {
    expectedVersion: 1,
    items: slots(["2026-11-04T10:00:00Z", "2026-11-04T11:00:00Z"]),
  });
  await ctx.schedules.confirmProposal(user(A), scheduleId, 2);
  await ctx.schedules.confirmProposal(user(B), scheduleId, 2);
  historical.endAt = historical.startAt;
  await ctx.paths.validateForFinalize(user(A), pathId);
  const current = ctx.db
    .rows("scheduleItem")
    .find(
      (i) => i.scheduleProposalId === scheduleId && i.scheduleVersion === 2,
    );
  current.endAt = current.startAt;
  await assert.rejects(
    ctx.paths.validateForFinalize(user(A), pathId),
    (error) => {
      assert.equal(error.getResponse().invalidItems.length, 1);
      assert.equal(error.getResponse().invalidItems[0].scheduleVersion, 2);
      return true;
    },
  );
});

test("both HTTP routes preserve real service invalid-item details", async () => {
  const ctx = await twoWay();
  const invalid = expiredSecondSession(ctx);
  const module = await Test.createTestingModule({
    controllers: [LearningPathsController],
    providers: [{ provide: LearningPathsService, useValue: ctx.paths }],
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
    for (const route of ["final-validation", "finalize"]) {
      const response = await fetch(
        `${await app.getUrl()}/api/v1/learning-paths/${ctx.pathId}/${route}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `check-${route}`,
          },
          body: JSON.stringify({ expectedVersion: 1 }),
        },
      );
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), {
        success: false,
        statusCode: 409,
        message: "INVALID_SCHEDULE_ITEMS",
        details: {
          invalidItems: [invalid],
          evaluatedAt: ctx.clock.now.toISOString(),
          durationMinutes: { min: 60, max: 180 },
        },
      });
    }
    assertNoLock(ctx);
  } finally {
    await app.close();
  }
});

test("HTTP detail allowlist strips unknown properties and supports reversed time and 200 errors", async () => {
  const ctx = await twoWay();
  const invalid = expiredSecondSession(ctx);
  invalid.endAt = invalid.startAt;
  invalid.reasons = ["START_NOT_IN_FUTURE", "END_NOT_AFTER_START"];
  const detail = {
    invalidItems: [{ ...invalid, privateEvidence: "hidden" }],
    evaluatedAt: ctx.clock.now.toISOString(),
    durationMinutes: { min: 60, max: 180, secret: "hidden" },
    stack: "hidden",
  };
  assert.deepEqual(
    invalidScheduleDetails(409, "INVALID_SCHEDULE_ITEMS", detail),
    {
      invalidItems: [invalid],
      evaluatedAt: detail.evaluatedAt,
      durationMinutes: { min: 60, max: 180 },
    },
  );
  const many = {
    ...detail,
    invalidItems: Array.from({ length: 200 }, (_, i) => ({
      ...invalid,
      sessionNo: (i % 100) + 1,
    })),
  };
  assert.equal(
    invalidScheduleDetails(409, "INVALID_SCHEDULE_ITEMS", many).invalidItems
      .length,
    200,
  );
  for (const malformed of [
    { ...detail, evaluatedAt: "invalid" },
    { ...detail, durationMinutes: { min: 180, max: 60 } },
    { ...detail, invalidItems: [] },
    { ...detail, invalidItems: [...many.invalidItems, invalid] },
    ...[
      { teacherId: "invalid" },
      { teacherId: A },
      { scheduleVersion: 0 },
      { sessionNo: -1 },
      { endAt: "invalid" },
      { reasons: [] },
      { reasons: ["INTERNAL_SECRET"] },
      { reasons: ["DURATION_TOO_LONG", "DURATION_TOO_LONG"] },
    ].map((patch) => ({ ...detail, invalidItems: [{ ...invalid, ...patch }] })),
  ])
    assert.equal(
      invalidScheduleDetails(409, "INVALID_SCHEDULE_ITEMS", malformed),
      undefined,
    );
  assert.equal(
    invalidScheduleDetails(403, "INVALID_SCHEDULE_ITEMS", detail),
    undefined,
  );
  assert.equal(invalidScheduleDetails(409, "OTHER_ERROR", detail), undefined);
});
