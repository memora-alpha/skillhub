import assert from "node:assert/strict";
import test from "node:test";
import { createLearningPathsApi } from "../src/features/learning-paths/api/learning-paths-api";
import { createPathOnce } from "../src/features/learning-paths/api/creation-attempt";
import { CommandIntent } from "../src/lib/http/command-intent";
import { AppError } from "../src/lib/http/errors";
import type { RequestOptions } from "../src/lib/http/client";
import {
  agreementPath,
  teacherId,
  learnerId,
  withConfirmedSchedules,
} from "./fixtures/learning-agreement";

function adapter() {
  let response: unknown;
  const calls: { path: string; options?: RequestOptions }[] = [];
  return {
    calls,
    respond(value: unknown) {
      response = value;
    },
    api: createLearningPathsApi(async (path, options) => {
      calls.push({ path, options });
      return response;
    }, teacherId),
  };
}

test("path detail rejects wrong identity, malformed plan outlines and another agreement version", async () => {
  const h = adapter();
  const path = agreementPath();
  h.respond(path);
  assert.equal((await h.api.detail(path.id)).id, path.id);
  for (const invalid of [
    { ...path, participantAId: path.conversationId },
    { ...path, agreement: { ...path.agreement, version: 1 } },
    { ...path, plans: [{ ...path.plans[0], sessionOutline: [] }] },
  ]) {
    h.respond(invalid);
    await assert.rejects(h.api.detail(path.id), AppError);
  }
});

test("schedule and learner confirmations send exactly the viewed version", async () => {
  const h = adapter();
  const path = withConfirmedSchedules();
  const plan = path.plans[0]!;
  const schedule = plan.schedule!;
  h.respond({ id: schedule.id, version: 1, status: "PROPOSED" });
  await h.api.schedule(plan.id, plan.version, schedule.items);
  assert.deepEqual(h.calls.at(-1), {
    path: `/learning-plans/${plan.id}/schedule-proposals`,
    options: {
      method: "POST",
      body: { expectedPlanVersion: 2, items: schedule.items },
      idempotencyKey: undefined,
      replayAfterRenewal: false,
    },
  });
  h.respond({ id: plan.id, version: 2, status: "CONFIRMED" });
  await h.api.confirmPlan(plan.id, 2);
  assert.deepEqual(h.calls.at(-1)?.options?.body, { expectedVersion: 2 });
  h.respond({
    id: schedule.id,
    version: 4,
    status: "PROPOSED",
    bothConfirmed: true,
  });
  await h.api.confirmSchedule(schedule.id, 4);
  assert.deepEqual(h.calls.at(-1)?.options?.body, { expectedVersion: 4 });
  h.respond({
    id: schedule.id,
    version: 5,
    status: "PROPOSED",
    bothConfirmed: true,
  });
  await assert.rejects(h.api.confirmSchedule(schedule.id, 4), AppError);
});

test("validation never finalizes and finalize retries retain the same command identity", async () => {
  const h = adapter();
  const path = withConfirmedSchedules();
  h.respond({
    pathId: path.id,
    version: 3,
    exchangeType: "ONE_WAY",
    planCount: 1,
    scheduleCount: 1,
    ready: true,
  });
  await h.api.validate(path.id);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0]!.path, `/learning-paths/${path.id}/final-validation`);
  const intent = new CommandIntent();
  const key = intent.begin("finalize:path:v3", () => "hold-intent");
  intent.failed(new AppError("network"));
  assert.equal(
    intent.begin("finalize:path:v3", () => "wrong-new-key"),
    key,
  );
  assert.throws(
    () => intent.begin("finalize:path:v4", () => "wrong-new-key"),
    AppError,
  );
  h.respond({ pathId: path.id, version: 3, status: "SCHEDULED", sessions: [] });
  await h.api.finalize(path.id, 3, key);
  assert.equal(h.calls.at(-1)?.options?.idempotencyKey, "hold-intent");
  assert.equal(h.calls.at(-1)?.options?.replayAfterRenewal, false);
  assert.deepEqual(h.calls.at(-1)?.options?.body, { expectedVersion: 3 });
});

test("agreement PATCH excludes conversation and fields from the previous exchange type", async () => {
  const h = adapter();
  const path = agreementPath();
  h.respond({ id: path.id, version: 4, status: "PROPOSED" });
  await h.api.revise(
    path.id,
    {
      exchangeType: "ONE_WAY",
      teacherId,
      learnerId,
      negotiatedCredit: "10.50",
      conversationId: path.conversationId,
    } as Parameters<typeof h.api.create>[0],
    3,
  );
  assert.deepEqual(h.calls.at(-1)?.options?.body, {
    exchangeType: "ONE_WAY",
    teacherId,
    learnerId,
    negotiatedCredit: "10.50",
    expectedVersion: 3,
  });
});

test("non-idempotent create cannot replay an uncertain attempt across navigation", async () => {
  let creates = 0;
  await assert.rejects(
    createPathOnce("fixture:uncertain", async () => {
      creates++;
      throw new AppError("network");
    }),
    AppError,
  );
  await assert.rejects(
    createPathOnce("fixture:uncertain", async () => {
      creates++;
    }),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "PATH_CREATE_RECONCILE_REQUIRED",
  );
  assert.equal(creates, 1);
});

test("an explicitly rejected create can be corrected and sent again", async () => {
  await assert.rejects(
    createPathOnce("fixture:rejected", async () => {
      throw new AppError("http", 400);
    }),
    AppError,
  );
  assert.equal(
    await createPathOnce("fixture:rejected", async () => "created"),
    "created",
  );
});
