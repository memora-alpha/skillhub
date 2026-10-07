import assert from "node:assert/strict";
import { test } from "node:test";
import { ModerateLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/moderate-learning-request.use-case.js";

const requestId = "22222222-2222-4222-8222-222222222222";
const userId = "11111111-1111-4111-8111-111111111111";
const staffId = "33333333-3333-4333-8333-333333333333";
const now = new Date("2026-10-06T00:00:00.000Z");

function pendingRequest(overrides = {}) {
  return {
    id: requestId,
    ownerId: userId,
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
    ...overrides,
  };
}

function harness(request = pendingRequest()) {
  const writes = { transitions: [], audits: [], events: [], access: [] };
  const tx = { $queryRaw: async () => [] };
  const repository = {
    lock: async () => request,
    databaseNow: async () => now,
    transition: async (_tx, id, version, from, update) => {
      writes.transitions.push({ id, version, from, update });
      if (request.version !== version || !from.includes(request.status))
        return false;
      Object.assign(request, update, { version: version + 1, updatedAt: now });
      return true;
    },
  };
  const access = {
    assertAction: async (_tx, actor, permission) => {
      writes.access.push(permission);
      if (!actor.permissions.includes(permission)) throw new Error("forbidden");
      return actor;
    },
  };
  const transactions = { run: (work) => work(tx) };
  const audit = {
    validate: (input) => input,
    append: async (_tx, input) => {
      writes.audits.push(input);
      return { auditId: "55555555-5555-4555-8555-555555555555" };
    },
  };
  const outbox = {
    append: async (_tx, event) => writes.events.push(event),
  };
  const useCase = new ModerateLearningRequestUseCase(
    transactions,
    access,
    repository,
    audit,
    outbox,
  );
  return { useCase, request, writes };
}

const reviewer = {
  userId: staffId,
  sessionId: "66666666-6666-4666-8666-666666666666",
  securityVersion: 1,
  roles: ["STAFF"],
  permissions: ["learning-request:approve", "learning-request:reject"],
};
const context = {
  requestId: "77777777-7777-4777-8777-777777777777",
  correlationId: "88888888-8888-4888-8888-888888888888",
};

test("approval atomically moves only the reviewed pending version to OPEN", async () => {
  const { useCase, request, writes } = harness();
  const result = await useCase.execute(
    reviewer,
    requestId,
    "APPROVE",
    { expectedVersion: 3, reason: "Reviewed against current policy" },
    context,
  );
  assert.equal(request.status, "OPEN");
  assert.equal(request.moderationStatus, "APPROVED");
  assert.equal(request.moderationReviewedVersion, 3);
  assert.equal(request.version, 4);
  assert.equal(result.version, 4);
  assert.deepEqual(writes.access, ["learning-request:approve"]);
  assert.equal(writes.audits.length, 1);
  assert.equal(writes.events.length, 0);
});

test("rejection trims and stores a bounded plain-text reason and snapshot event", async () => {
  const { useCase, request, writes } = harness();
  await useCase.execute(
    reviewer,
    requestId,
    "REJECT",
    { expectedVersion: 3, reason: "  <b>Needs more detail</b>  " },
    context,
  );
  assert.equal(request.status, "REJECTED");
  assert.equal(request.moderationStatus, "REJECTED");
  assert.equal(request.moderationRejectReason, "Needs more detail");
  assert.deepEqual(writes.events[0].payload, {
    requestId,
    ownerId: userId,
    reviewedVersion: 3,
    decisionVersion: 4,
    rejectReason: "Needs more detail",
  });
  assert.equal(writes.events[0].type, "learning-request.rejected");
  assert.equal(writes.events[0].version, 1);
});

test("reject reasons enforce 10 and 500 code-point bounds and require text", async () => {
  for (const reason of ["x".repeat(9), "x".repeat(501), "   ", undefined]) {
    const { useCase, writes } = harness();
    await assert.rejects(() =>
      useCase.execute(
        reviewer,
        requestId,
        "REJECT",
        { expectedVersion: 3, reason },
        context,
      ),
    );
    assert.equal(writes.transitions.length, 0);
  }
  for (const reason of ["x".repeat(10), "x".repeat(500)]) {
    const { useCase, writes } = harness();
    await useCase.execute(
      reviewer,
      requestId,
      "REJECT",
      { expectedVersion: 3, reason },
      context,
    );
    assert.equal(writes.events.length, 1);
  }
});

test("stale, already-reviewed, unauthorized, and expired requests have no side effects", async () => {
  const cases = [
    [
      pendingRequest({ version: 4 }),
      { expectedVersion: 3, reason: "Reject with details" },
    ],
    [
      pendingRequest({ status: "OPEN", moderationStatus: "APPROVED" }),
      { expectedVersion: 3, reason: "Reject with details" },
    ],
    [
      pendingRequest({ expiresAt: now }),
      { expectedVersion: 3, reason: "Reject with details" },
    ],
  ];
  for (const [record, input] of cases) {
    const { useCase, writes } = harness(record);
    await assert.rejects(() =>
      useCase.execute(reviewer, requestId, "REJECT", input, context),
    );
    assert.equal(writes.transitions.length, 0);
    assert.equal(writes.audits.length, 0);
    assert.equal(writes.events.length, 0);
  }
  const { useCase, writes } = harness();
  await assert.rejects(() =>
    useCase.execute(
      { ...reviewer, permissions: ["learning-request:approve"] },
      requestId,
      "REJECT",
      { expectedVersion: 3, reason: "Reject with details" },
      context,
    ),
  );
  assert.equal(writes.transitions.length, 0);
});
