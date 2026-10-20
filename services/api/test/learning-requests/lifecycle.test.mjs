import assert from "node:assert/strict";
import { test } from "node:test";
import { CancelLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/cancel-learning-request.use-case.js";
import { LearningRequestLifecycleService } from "../../dist/modules/learning-requests/application/services/learning-request-lifecycle.service.js";
import { UnavailableLearningRequestDependencies } from "../../dist/modules/learning-requests/infrastructure/adapters/unavailable-learning-request-dependencies.js";

const now = new Date("2026-10-06T00:00:00.000Z");
const requestId = "22222222-2222-4222-8222-222222222222";
const ownerId = "11111111-1111-4111-8111-111111111111";
const proposerId = "33333333-3333-4333-8333-333333333333";

function record(status = "OPEN", overrides = {}) {
  return {
    id: requestId,
    ownerId,
    skillId: "44444444-4444-4444-8444-444444444444",
    title: "Learn backend engineering",
    description: "I want to improve my backend engineering skills.",
    learningGoal: "Build production-ready APIs with guidance.",
    currentLevel: "BEGINNER",
    verifiedTeacherOnly: false,
    status,
    moderationStatus:
      status === "PENDING_MODERATION" ? "PENDING" : "NOT_REQUIRED",
    moderationRejectReason: null,
    flaggedCategories: [],
    moderationRuleSetVersion: null,
    moderationReviewedVersion: null,
    moderatedByUserId: null,
    moderatedAt: null,
    requestedExpiresAt: null,
    expiresAt: new Date("2026-10-07T00:00:00.000Z"),
    publishedAt: new Date("2026-10-01T00:00:00.000Z"),
    expiryMode: "DEFAULT",
    version: 2,
    createdAt: now,
    updatedAt: now,
    preferredSlots: [],
    tagLinks: [],
    ...overrides,
  };
}

const owner = {
  userId: ownerId,
  sessionId: "55555555-5555-4555-8555-555555555555",
  securityVersion: 1,
  roles: ["USER"],
  permissions: ["learning-request:cancel:self"],
};

function cancelHarness(current) {
  const calls = { permission: [], lock: 0, transition: [] };
  const tx = { $queryRaw: async () => [] };
  const repository = {
    lock: async () => ((calls.lock += 1), current),
    databaseNow: async () => now,
    transition: async (_tx, _id, version, from, update) => {
      calls.transition.push({ version, from, update });
      if (current.version !== version || !from.includes(current.status))
        return false;
      Object.assign(current, update, { version: version + 1, updatedAt: now });
      return true;
    },
  };
  const access = {
    assertUserAction: async (_tx, actor, permission) => {
      calls.permission.push(permission);
      if (!actor.permissions.includes(permission))
        throw Object.assign(new Error(), { status: 403 });
      return actor;
    },
  };
  const lockReader = {
    assertNotLocked: async () => {
      calls.lockReader = (calls.lockReader ?? 0) + 1;
    },
  };
  return {
    calls,
    lockReader,
    useCase: new CancelLearningRequestUseCase(
      { run: (work) => work(tx) },
      access,
      repository,
      lockReader,
    ),
  };
}

test("owner can cancel permitted states, with Negotiating checked against Schedule lock", async () => {
  for (const status of [
    "DRAFT",
    "OPEN",
    "PENDING_MODERATION",
    "REJECTED",
    "NEGOTIATING",
  ]) {
    const current = record(status);
    const { useCase, calls } = cancelHarness(current);
    const result = await useCase.execute(owner, requestId, {
      expectedVersion: 2,
    });
    assert.equal(current.status, "CANCELLED");
    assert.equal(result.status, "CANCELLED");
    assert.equal(result.version, 3);
    assert.equal(calls.permission[0], "learning-request:cancel:self");
    assert.equal(calls.lockReader ?? 0, status === "NEGOTIATING" ? 1 : 0);
  }
});

test("wrong owner, stale version, expired open request, and locked negotiation have no transition", async () => {
  for (const [current, actor] of [
    [record("OPEN"), { ...owner, userId: proposerId }],
    [record("OPEN", { version: 3 }), owner],
    [record("OPEN", { expiresAt: now }), owner],
  ]) {
    const { useCase, calls } = cancelHarness(current);
    await assert.rejects(() =>
      useCase.execute(actor, requestId, { expectedVersion: 2 }),
    );
    assert.equal(calls.transition.length, 0);
  }
  const current = record("NEGOTIATING");
  const { calls, lockReader, useCase } = cancelHarness(current);
  lockReader.assertNotLocked = async () => {
    throw Object.assign(new Error("schedule already locked"), { status: 409 });
  };
  await assert.rejects(() =>
    useCase.execute(owner, requestId, { expectedVersion: 2 }),
  );
  assert.equal(calls.transition.length, 0);
});

test("Proposal owner contract checks OPEN, expiry and self-proposal then begins negotiation by version", async () => {
  const current = record("OPEN");
  const repository = {
    lock: async () => current,
    databaseNow: async () => now,
    transition: async (_tx, _id, version, from, update) => {
      if (current.version !== version || !from.includes(current.status))
        return false;
      Object.assign(current, update, { version: version + 1 });
      return true;
    },
  };
  const service = new LearningRequestLifecycleService(repository);
  const tx = {};
  assert.deepEqual(await service.lockForProposal(tx, requestId, proposerId), {
    requestId,
    ownerId,
    skillId: current.skillId,
    verifiedTeacherOnly: false,
    version: 2,
  });
  await assert.rejects(() => service.lockForProposal(tx, requestId, ownerId));
  await assert.rejects(() => service.beginNegotiation(tx, requestId, 1));
  await service.beginNegotiation(tx, requestId, 2);
  assert.equal(current.status, "NEGOTIATING");
  assert.equal(current.version, 3);
});

test("Path/Schedule owner contracts move only NEGOTIATING to MATCHED to CLOSED", async () => {
  const current = record("NEGOTIATING");
  const repository = {
    lock: async () => current,
    databaseNow: async () => now,
    transition: async (_tx, _id, version, from, update) => {
      if (current.version !== version || !from.includes(current.status))
        return false;
      Object.assign(current, update, { version: version + 1 });
      return true;
    },
  };
  const service = new LearningRequestLifecycleService(repository);
  await service.markMatched({}, requestId, 2);
  assert.equal(current.status, "MATCHED");
  await service.markClosed({}, requestId, 3);
  assert.equal(current.status, "CLOSED");
  await assert.rejects(() => service.markClosed({}, requestId, 4));
});

test("missing Path/Schedule lock adapter fails closed for Negotiating cancellation", async () => {
  const current = record("NEGOTIATING");
  const { useCase } = cancelHarness(current);
  const unavailable = new UnavailableLearningRequestDependencies();
  useCase.requestLock = unavailable;
  await assert.rejects(
    () => useCase.execute(owner, requestId, { expectedVersion: 2 }),
    (error) => error.getStatus?.() === 503,
  );
  assert.equal(current.status, "NEGOTIATING");
});
