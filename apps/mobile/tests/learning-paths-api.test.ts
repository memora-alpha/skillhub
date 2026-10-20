import assert from "node:assert/strict";
import test from "node:test";
import { createLearningPathsApi } from "../src/features/learning-paths/api/learning-paths-api";
import { createPathOnce } from "../src/features/learning-paths/api/creation-attempt";
import {
  canConfirmPlan,
  canCreatePlan,
  canSchedule,
  canConfirmSchedule,
  canValidateForFinalize,
  ownConfirmation,
} from "../src/features/learning-paths/policy-api";
import {
  scheduleInputSchema,
  scheduleItems,
} from "../src/features/learning-paths/schedule-input";
import { AppError } from "../src/lib/http/errors";
import type { RequestOptions } from "../src/lib/http/client";
import type { ApiLearningPath } from "../src/features/learning-paths/api/learning-paths-contract";

const id = (n: number) =>
  `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = "2026-10-16T10:00:00.000Z";
function path(): ApiLearningPath {
  return {
    id: id(1),
    conversationId: id(2),
    status: "PROPOSED",
    participantAId: id(3),
    participantBId: id(4),
    currentVersion: 2,
    lockedVersion: null,
    completedAt: null,
    settledAt: null,
    agreement: {
      version: 2,
      exchangeType: "TWO_WAY",
      totalCreditPerUser: "20.00",
      negotiatedCredit: null,
      teacherId: null,
      learnerId: null,
      participantAConfirmedAt: null,
      participantBConfirmedAt: null,
    },
    plans: [
      {
        id: id(5),
        version: 3,
        status: "PROPOSED",
        teacherId: id(3),
        learnerId: id(4),
        skillId: id(6),
        learningGoal: "Mục tiêu",
        totalSessions: 1,
        learnerConfirmedAt: null,
        sessionOutline: [{ sessionNo: 1, content: "Buổi đầu" }],
        schedule: null,
        sessions: [],
      },
    ],
  };
}
test("participant reads accept new projections and reject foreign, mismatched and stale details", async () => {
  let data: unknown = path();
  const api = createLearningPathsApi(async () => data, id(3));
  assert.equal((await api.detail(id(1))).plans[0]?.version, 3);
  data = { ...path(), participantAId: id(9) };
  await assert.rejects(api.detail(id(1)), AppError);
  data = { ...path(), id: id(9) };
  await assert.rejects(api.detail(id(1)), AppError);
  data = { ...path(), currentVersion: 3 };
  await assert.rejects(api.detail(id(1)), AppError);
  const badOutline = path();
  badOutline.plans[0]!.sessionOutline[0]!.sessionNo = 2;
  data = badOutline;
  await assert.rejects(api.detail(id(1)), AppError);
});
test("mine is an unpaginated bounded array and rejects duplicate identities", async () => {
  const summary = {
    id: id(1),
    conversationId: id(2),
    counterpartId: id(4),
    status: "PROPOSED",
    exchangeType: "TWO_WAY",
    currentVersion: 1,
    lockedVersion: null,
    createdAt: now,
    updatedAt: now,
  };
  let data: unknown = [summary];
  const api = createLearningPathsApi(async (url) => {
    assert.equal(url, "/learning-paths/mine");
    return data;
  }, id(3));
  assert.equal((await api.mine()).length, 1);
  data = { items: [summary] };
  await assert.rejects(api.mine(), AppError);
  data = [summary, summary];
  await assert.rejects(api.mine(), AppError);
});
test("directions and learner confirmations belong to the right account and version", () => {
  const p = path(),
    plan = p.plans[0]!;
  assert.equal(canCreatePlan(p, id(3)), false);
  assert.equal(canCreatePlan(p, id(4)), true);
  assert.equal(canCreatePlan(p, id(99)), false);
  assert.equal(canConfirmPlan(p, plan, id(3)), false);
  assert.equal(canConfirmPlan(p, plan, id(4)), true);
  p.agreement.exchangeType = "ONE_WAY";
  p.agreement.teacherId = id(3);
  assert.equal(canCreatePlan(p, id(4)), false);
  p.agreement.participantAConfirmedAt = now;
  assert.equal(ownConfirmation(p, p.agreement, id(3)), now);
  assert.equal(ownConfirmation(p, p.agreement, id(4)), null);
  plan.learnerConfirmedAt = now;
  assert.equal(canConfirmPlan(p, plan, id(4)), false);
  p.lockedVersion = 2;
  assert.equal(canCreatePlan(p, id(4)), false);
});
test("agreement edits send only the selected exchange terms, never create-only or previous variant fields", async () => {
  const bodies: unknown[] = [];
  const api = createLearningPathsApi(async (_url, options) => {
    bodies.push(options?.body);
    return { id: id(1), version: 3, status: "PROPOSED" };
  }, id(3));
  await api.revise(
    id(1),
    {
      conversationId: id(2),
      exchangeType: "TWO_WAY",
      totalCreditPerUser: "25.00",
      negotiatedCredit: "99",
    } as Parameters<typeof api.revise>[1],
    2,
  );
  await api.revise(
    id(1),
    {
      conversationId: id(2),
      exchangeType: "ONE_WAY",
      teacherId: id(3),
      learnerId: id(4),
      negotiatedCredit: "30.00",
      totalCreditPerUser: "99",
    } as Parameters<typeof api.revise>[1],
    2,
  );
  assert.deepEqual(bodies, [
    {
      exchangeType: "TWO_WAY",
      totalCreditPerUser: "25.00",
      expectedVersion: 2,
    },
    {
      exchangeType: "ONE_WAY",
      teacherId: id(3),
      learnerId: id(4),
      negotiatedCredit: "30.00",
      expectedVersion: 2,
    },
  ]);
});
test("confirmation responses must match the resource and submitted version", async () => {
  let result = {
    id: id(5),
    version: 3,
    currentVersion: 3,
    status: "CONFIRMED",
    bothConfirmed: true,
  };
  const api = createLearningPathsApi(async () => result, id(3));
  await api.confirmPlan(id(5), 3);
  await assert.rejects(api.confirmPlan(id(5), 2), AppError);
  await assert.rejects(api.confirm(id(1), 3), AppError);
  await assert.rejects(api.confirmSchedule(id(7), 3), AppError);
  result = { ...result, id: id(7) };
  await assert.rejects(api.confirmSchedule(id(7), 2), AppError);
});
test("finalization requires current confirmed directions and live schedules; cancelled schedules cannot be confirmed", () => {
  const p = path(),
    plan = p.plans[0]!;
  p.status = "CONFIRMED";
  p.agreement = {
    ...p.agreement,
    exchangeType: "ONE_WAY",
    teacherId: id(3),
    learnerId: id(4),
    negotiatedCredit: "30.00",
    totalCreditPerUser: null,
    participantAConfirmedAt: now,
    participantBConfirmedAt: now,
  };
  plan.status = "CONFIRMED";
  plan.learnerConfirmedAt = now;
  plan.schedule = {
    id: id(7),
    version: 1,
    appliedVersion: null,
    status: "PROPOSED",
    participantAConfirmedAt: now,
    participantBConfirmedAt: now,
    items: [{ sessionNo: 1, startAt: now, endAt: "2026-10-16T11:00:00Z" }],
  };
  assert.equal(canValidateForFinalize(p), true);
  plan.schedule.participantBConfirmedAt = null;
  assert.equal(canConfirmSchedule(p, plan, id(4)), true);
  assert.equal(canConfirmSchedule(p, plan, id(3)), false);
  assert.equal(canConfirmSchedule(p, plan, id(99)), false);
  assert.equal(canValidateForFinalize(p), false);
  plan.schedule.participantBConfirmedAt = now;
  for (const status of [
    "CANCELLED",
    "EXPIRED",
    "NEEDS_REVISION",
    "LOCKED",
  ] as const) {
    plan.schedule.status = status;
    assert.equal(canConfirmSchedule(p, plan, id(4)), false);
    assert.equal(canValidateForFinalize(p), false);
  }
  plan.schedule.status = "PROPOSED";
  plan.status = "NEEDS_REVISION";
  assert.equal(canValidateForFinalize(p), false);
  plan.status = "CONFIRMED";
  p.agreement.exchangeType = "TWO_WAY";
  p.plans.push({ ...plan, id: id(8) });
  assert.equal(canValidateForFinalize(p), false);
  p.plans[1] = { ...plan, id: id(8), teacherId: id(4), learnerId: id(3) };
  assert.equal(canValidateForFinalize(p), true);
  p.lockedVersion = p.currentVersion;
  assert.equal(canValidateForFinalize(p), false);
});
test("schedule creation requires confirmed agreement, confirmed learner, teacher and no existing schedule", () => {
  const p = path(),
    plan = p.plans[0]!;
  assert.equal(canSchedule(p, plan, id(3)), false);
  p.status = "CONFIRMED";
  plan.status = "CONFIRMED";
  plan.learnerConfirmedAt = now;
  assert.equal(canSchedule(p, plan, id(3)), true);
  assert.equal(canSchedule(p, plan, id(4)), false);
  plan.schedule = {
    id: id(7),
    version: 1,
    appliedVersion: null,
    status: "PROPOSED",
    participantAConfirmedAt: null,
    participantBConfirmedAt: null,
    items: [],
  };
  assert.equal(canSchedule(p, plan, id(3)), false);
});
test("command DTOs carry separate plan/path versions and finalize reuses supplied identity", async () => {
  const calls: { url: string; options?: RequestOptions }[] = [];
  const api = createLearningPathsApi(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/finalize"))
      return {
        pathId: id(1),
        version: 2,
        status: "SCHEDULED",
        sessions: [
          {
            id: id(8),
            planId: id(5),
            startAt: now,
            endAt: "2026-10-16T11:00:00Z",
          },
        ],
      };
    return { id: id(7), version: 1, status: "PROPOSED" };
  }, id(3));
  await api.schedule(id(5), 3, [
    { sessionNo: 1, startAt: now, endAt: "2026-10-16T11:00:00Z" },
  ]);
  assert.equal(calls[0]?.url, `/learning-plans/${id(5)}/schedule-proposals`);
  assert.equal(
    (calls[0]?.options?.body as { expectedPlanVersion: number })
      .expectedPlanVersion,
    3,
  );
  await api.finalize(id(1), 2, "same-attempt");
  await api.finalize(id(1), 2, "same-attempt");
  assert.equal(calls[1]?.options?.idempotencyKey, "same-attempt");
  assert.deepEqual(calls[1]?.options, calls[2]?.options);
  assert.equal(calls[1]?.options?.replayAfterRenewal, false);
  assert.deepEqual(calls[1]?.options?.body, { expectedVersion: 2 });
});
test("unknown create results block a second send across callers; definite rejection permits correction", async () => {
  let sent = 0;
  const send = async () => {
    sent++;
    throw new AppError("network");
  };
  await assert.rejects(createPathOnce("unknown-test", send));
  await assert.rejects(
    createPathOnce("unknown-test", send),
    (e: unknown) =>
      e instanceof AppError && e.code === "PATH_CREATE_RECONCILE_REQUIRED",
  );
  assert.equal(sent, 1);
  await assert.rejects(
    createPathOnce("rejected-test", async () => {
      throw new AppError("http", 400);
    }),
  );
  assert.equal(await createPathOnce("rejected-test", async () => "ok"), "ok");
});
test("schedule input validates calendar, future time, duration, order and serializes timezone", () => {
  const valid = {
    items: [
      { local: "2099-11-20T19:00", minutes: "60" },
      { local: "2099-11-20T20:00", minutes: "180" },
    ],
  };
  const result = scheduleItems(valid);
  assert.equal(result[0]?.sessionNo, 1);
  assert.ok(result[0]?.startAt.endsWith("Z"));
  assert.equal(
    new Date(result[1]!.endAt).getTime() -
      new Date(result[1]!.startAt).getTime(),
    180 * 60000,
  );
  for (const local of [
    "2099-02-30T19:00",
    "2099-11-20T24:00",
    "2020-01-01T10:00",
  ])
    assert.equal(
      scheduleInputSchema.safeParse({ items: [{ local, minutes: "60" }] })
        .success,
      false,
    );
  for (const minutes of ["59", "181", "60.5"])
    assert.equal(
      scheduleInputSchema.safeParse({
        items: [{ local: valid.items[0]!.local, minutes }],
      }).success,
      false,
    );
  assert.equal(
    scheduleInputSchema.safeParse({ items: [valid.items[1], valid.items[0]] })
      .success,
    false,
  );
});
