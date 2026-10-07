import assert from "node:assert/strict";
import { test } from "node:test";
import { ModerateLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/moderate-learning-request.use-case.js";
import { AuditWriter } from "../../dist/modules/audit/application/audit-writer.js";
import { AuditRepository } from "../../dist/modules/audit/infrastructure/audit.repository.js";
import { OutboxWriter } from "../../dist/infrastructure/events/outbox-writer.js";

const requestId = "22222222-2222-4222-8222-222222222222";
const ownerId = "11111111-1111-4111-8111-111111111111";
const reviewerId = "33333333-3333-4333-8333-333333333333";
const now = new Date("2026-10-06T00:00:00.000Z");

function seed() {
  return {
    id: requestId,
    ownerId,
    skillId: "44444444-4444-4444-8444-444444444444",
    title: "Learn backend engineering",
    description: "I want to improve my backend engineering skills.",
    learningGoal: "Build production-ready APIs with guidance.",
    currentLevel: "BEGINNER",
    verifiedTeacherOnly: false,
    status: "PENDING_MODERATION",
    moderationStatus: "PENDING",
    moderationRejectReason: null,
    flaggedCategories: ["TEST"],
    moderationRuleSetVersion: 2,
    moderationReviewedVersion: null,
    moderatedByUserId: null,
    moderatedAt: null,
    version: 3,
    expiresAt: new Date("2026-10-07T00:00:00.000Z"),
    createdAt: now,
    updatedAt: now,
    preferredSlots: [],
    tagLinks: [],
  };
}

function transactionalHarness(failAt) {
  const store = { request: seed(), audits: [], events: [] };
  const txStates = new WeakMap();
  const runner = {
    run: async (work) => {
      const txState = {
        request: structuredClone(store.request),
        audits: [],
        events: [],
      };
      const tx = {
        __state: txState,
        $queryRaw: async () => [],
        auditLog: {
          create: async ({ data }) => {
            if (failAt === "audit") throw new Error("audit insert failed");
            txState.audits.push(data);
            return { id: data.id };
          },
        },
        outboxEvent: {
          create: async ({ data }) => {
            if (failAt === "outbox") throw new Error("outbox insert failed");
            txState.events.push(data);
            return data;
          },
        },
      };
      txStates.set(tx, txState);
      const result = await work(tx);
      store.request = txState.request;
      store.audits = txState.audits;
      store.events = txState.events;
      return result;
    },
  };
  const repository = {
    lock: async (tx) => txStates.get(tx).request,
    databaseNow: async () => now,
    transition: async (tx, _id, version, from, update) => {
      const request = txStates.get(tx).request;
      if (request.version !== version || !from.includes(request.status))
        return false;
      Object.assign(request, update, { version: version + 1, updatedAt: now });
      return true;
    },
  };
  const access = { assertAction: async (_tx, actor) => actor };
  const useCase = new ModerateLearningRequestUseCase(
    runner,
    access,
    repository,
    new AuditWriter(new AuditRepository()),
    new OutboxWriter(),
  );
  return { store, useCase };
}

const reviewer = {
  userId: reviewerId,
  sessionId: "66666666-6666-4666-8666-666666666666",
  securityVersion: 1,
  roles: ["STAFF"],
  permissions: ["learning-request:reject"],
};
const context = {
  requestId: "77777777-7777-4777-8777-777777777777",
  correlationId: "88888888-8888-4888-8888-888888888888",
};

for (const failure of ["audit", "outbox"]) {
  test(`${failure} insert failure rolls back request, audit, and event`, async () => {
    const { store, useCase } = transactionalHarness(failure);
    await assert.rejects(() =>
      useCase.execute(
        reviewer,
        requestId,
        "REJECT",
        { expectedVersion: 3, reason: "The request needs more detail" },
        context,
      ),
    );
    assert.equal(store.request.status, "PENDING_MODERATION");
    assert.equal(store.request.version, 3);
    assert.equal(store.audits.length, 0);
    assert.equal(store.events.length, 0);
  });
}

test("moderation audit stores status and positive requestVersion only", async () => {
  const { store, useCase } = transactionalHarness();
  await useCase.execute(
    reviewer,
    requestId,
    "REJECT",
    { expectedVersion: 3, reason: "The request needs more detail" },
    context,
  );
  assert.deepEqual(store.audits[0].before, {
    status: "PENDING",
    requestVersion: 3,
  });
  assert.deepEqual(store.audits[0].after, {
    status: "REJECTED",
    requestVersion: 4,
  });
  assert.equal(store.audits[0].action, "LEARNING_REQUEST_MODERATE");
  assert.equal("title" in store.audits[0].before, false);
  assert.equal("flaggedCategories" in store.audits[0].after, false);
  assert.equal(store.events.length, 1);
});

test("transaction retry keeps the rejection event ID stable", async () => {
  const events = [];
  let attempts = 0;
  const transactions = {
    run: async (work) => {
      attempts += 1;
      await work({ request: seed(), $queryRaw: async () => [] });
      attempts += 1;
      return work({ request: seed(), $queryRaw: async () => [] });
    },
  };
  const repository = {
    lock: async (tx) => tx.request,
    databaseNow: async () => now,
    transition: async (tx, _id, version, from, update) => {
      if (tx.request.version !== version || !from.includes(tx.request.status))
        return false;
      Object.assign(tx.request, update, { version: version + 1 });
      return true;
    },
  };
  const useCase = new ModerateLearningRequestUseCase(
    transactions,
    { assertAction: async (_tx, actor) => actor },
    repository,
    { validate: (input) => input, append: async () => ({ auditId: "audit" }) },
    { append: async (_tx, event) => events.push(event.eventId) },
  );
  await useCase.execute(
    reviewer,
    requestId,
    "REJECT",
    { expectedVersion: 3, reason: "The request needs more detail" },
    context,
  );
  assert.equal(attempts, 2);
  assert.equal(events.length, 2);
  assert.match(events[0], /^[0-9a-f-]{36}$/i);
  assert.equal(events[0], events[1]);
});
