import assert from "node:assert/strict";
import { test } from "node:test";
import { CreateLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/create-learning-request.use-case.js";
import { PublishLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/publish-learning-request.use-case.js";
import { TransactionRunner } from "../../dist/infrastructure/database/transaction-runner.js";

test("draft creation persists sanitized text and canonical tag IDs under the live owner", async () => {
  const calls = [];
  const now = new Date("2026-10-06T00:00:00.000Z");
  const useCase = new CreateLearningRequestUseCase(
    { run: async (work) => work({ $queryRaw: async () => [] }) },
    { assertUserAction: async (_tx, actor) => actor },
    { assertAllowed: async () => {} },
    {
      assertActiveSelection: async (_tx, selection) => ({
        skillId: selection.skillId,
        tags: [
          { id: "33333333-3333-4333-8333-333333333333", label: "Conversation" },
        ],
      }),
    },
    {
      databaseNow: async () => now,
      create: async (_tx, input) => (
        calls.push(input),
        {
          id: "req-1",
          ...input,
          status: "DRAFT",
          moderationStatus: "NOT_REQUIRED",
          moderationRejectReason: null,
          tagLinks: input.tagIds.map((tagId) => ({ tagId })),
          preferredSlots: input.preferredSlots,
          expiresAt: null,
          publishedAt: null,
          version: 1,
          createdAt: now,
          updatedAt: now,
        }
      ),
    },
  );
  const result = await useCase.execute(
    {
      userId: "owner-1",
      roles: ["USER"],
      permissions: ["learning-request:create"],
    },
    {
      title: "Learn Vietnamese",
      skillId: "11111111-1111-4111-8111-111111111111",
      description: "<b>Practice speaking</b> with a partner.",
      learningGoal: "Hold a short conversation.",
      tagIds: ["33333333-3333-4333-8333-333333333333"],
      verifiedTeacherOnly: true,
    },
  );
  assert.equal(calls[0].ownerId, "owner-1");
  assert.equal(calls[0].description, "Practice speaking with a partner.");
  assert.deepEqual(calls[0].tagIds, ["33333333-3333-4333-8333-333333333333"]);
  assert.equal(result.status, "DRAFT");
  assert.equal(calls[0].verifiedTeacherOnly, true);
  assert.equal(result.verifiedTeacherOnly, true);
});

test("Nest can resolve the transaction runner for both write use cases", () => {
  for (const useCase of [
    CreateLearningRequestUseCase,
    PublishLearningRequestUseCase,
  ]) {
    assert.equal(
      Reflect.getMetadata("design:paramtypes", useCase)[0],
      TransactionRunner,
    );
  }
});

test("draft creation rejects Catalog selections that are not canonical", async () => {
  let writes = 0;
  const now = new Date("2026-10-06T00:00:00.000Z");
  const useCase = new CreateLearningRequestUseCase(
    { run: async (work) => work({ $queryRaw: async () => [] }) },
    { assertUserAction: async (_tx, actor) => actor },
    { assertAllowed: async () => {} },
    {
      assertActiveSelection: async (_tx, selection) => ({
        skillId: selection.skillId,
        tags: [],
      }),
    },
    { databaseNow: async () => now, create: async () => (writes += 1) },
  );
  await assert.rejects(
    () =>
      useCase.execute(
        {
          userId: "owner-1",
          roles: ["USER"],
          permissions: ["learning-request:create"],
        },
        {
          title: "Learn Vietnamese",
          skillId: "11111111-1111-4111-8111-111111111111",
          description: "Practice speaking with a partner.",
          learningGoal: "Hold a short conversation.",
          tagIds: ["33333333-3333-4333-8333-333333333333"],
        },
      ),
    (error) => error?.getStatus?.() === 400,
  );
  assert.equal(writes, 0);
});

test("publish keeps a draft unchanged when rules are unavailable", async () => {
  const calls = [];
  const request = {
    id: "req-1",
    ownerId: "owner-1",
    skillId: "skill-1",
    title: "Learn Vietnamese",
    description: "Practice speaking with a partner.",
    learningGoal: "Hold a short conversation.",
    currentLevel: null,
    verifiedTeacherOnly: false,
    status: "DRAFT",
    moderationStatus: "NOT_REQUIRED",
    version: 1,
    tagLinks: [],
    preferredSlots: [],
    requestedExpiresAt: null,
    expiresAt: null,
  };
  const useCase = new PublishLearningRequestUseCase(
    { run: async (work) => work({ $queryRaw: async () => [] }) },
    { assertUserAction: async (_tx, actor) => actor },
    { assertAllowed: async () => {} },
    {
      get: async () => request,
      lock: async () => request,
      databaseNow: async () => new Date("2026-10-06T00:00:00Z"),
      transition: async (...args) => calls.push(args),
    },
    {
      assertActiveSelection: async (_tx, selection) => ({
        skillId: selection.skillId,
        tags: [],
      }),
    },
    {
      getSnapshot: async () => ({
        values: { "learningRequest.moderationRuleSet": { rules: [] } },
        versions: { "learningRequest.moderationRuleSet": 1 },
        readAt: new Date("2026-10-06T00:00:00Z"),
      }),
    },
    { now: () => new Date("2026-10-06T00:00:00Z") },
  );
  await assert.rejects(
    () =>
      useCase.execute(
        {
          userId: "owner-1",
          roles: ["USER"],
          permissions: ["learning-request:create"],
        },
        "req-1",
        { expectedVersion: 1 },
      ),
    (error) => error?.getStatus?.() === 503,
  );
  assert.equal(calls.length, 0);
});

test("publish clears only on a clean versioned snapshot and flags matched content", async () => {
  const publish = async (title, rules) => {
    const now = new Date("2026-10-06T00:00:00Z");
    const request = {
      id: "req-1",
      ownerId: "owner-1",
      skillId: "skill-1",
      title,
      description: "Practice speaking with a partner.",
      learningGoal: "Hold a short conversation.",
      currentLevel: null,
      verifiedTeacherOnly: false,
      status: "DRAFT",
      moderationStatus: "NOT_REQUIRED",
      version: 1,
      tagLinks: [],
      preferredSlots: [],
      requestedExpiresAt: null,
      expiresAt: null,
    };
    const writes = [];
    const useCase = new PublishLearningRequestUseCase(
      { run: async (work) => work({ $queryRaw: async () => [] }) },
      { assertUserAction: async (_tx, actor) => actor },
      { assertAllowed: async () => {} },
      {
        get: async () => request,
        lock: async () => request,
        databaseNow: async () => now,
        transition: async (_tx, id, version, from, values) => (
          writes.push(values),
          true
        ),
      },
      {
        assertActiveSelection: async (_tx, selection) => ({
          skillId: selection.skillId,
          tags: [],
        }),
      },
      {
        getSnapshot: async () => ({
          values: { "learningRequest.moderationRuleSet": { rules } },
          versions: { "learningRequest.moderationRuleSet": 4 },
          readAt: now,
        }),
      },
      { now: () => now },
    );
    const result = await useCase.execute(
      {
        userId: "owner-1",
        roles: ["USER"],
        permissions: ["learning-request:create"],
      },
      "req-1",
      { expectedVersion: 1 },
    );
    return { result, writes };
  };
  const clear = await publish("Learn Vietnamese", [
    { category: "TEST", pattern: "blocked phrase" },
  ]);
  assert.equal(clear.writes[0].status, "OPEN");
  assert.equal(clear.writes[0].moderationRuleSetVersion, 4);
  assert.equal(clear.result.version, 2);
  const flagged = await publish("blocked phrase", [
    { category: "TEST", pattern: "blocked phrase" },
  ]);
  assert.equal(flagged.writes[0].status, "PENDING_MODERATION");
  assert.deepEqual(flagged.writes[0].flaggedCategories, ["TEST"]);
});

test("publish hides a different owner and rejects requests outside DRAFT", async () => {
  const now = new Date("2026-10-06T00:00:00Z");
  const request = {
    id: "req-1",
    ownerId: "owner-1",
    skillId: "skill-1",
    title: "Learn Vietnamese",
    description: "Practice speaking with a partner.",
    learningGoal: "Hold a short conversation.",
    currentLevel: null,
    verifiedTeacherOnly: false,
    status: "DRAFT",
    moderationStatus: "NOT_REQUIRED",
    version: 1,
    tagLinks: [],
    preferredSlots: [],
    requestedExpiresAt: null,
    expiresAt: null,
  };
  const createUseCase = (current) =>
    new PublishLearningRequestUseCase(
      { run: async (work) => work({ $queryRaw: async () => [] }) },
      { assertUserAction: async (_tx, actor) => actor },
      { assertAllowed: async () => {} },
      {
        get: async () => current,
        lock: async () => current,
        databaseNow: async () => now,
        transition: async () => true,
      },
      {
        assertActiveSelection: async (_tx, selection) => ({
          skillId: selection.skillId,
          tags: [],
        }),
      },
      {
        getSnapshot: async () => ({
          values: {
            "learningRequest.moderationRuleSet": {
              rules: [{ category: "TEST", pattern: "blocked phrase" }],
            },
          },
          versions: { "learningRequest.moderationRuleSet": 1 },
          readAt: now,
        }),
      },
    );
  await assert.rejects(
    () =>
      createUseCase(request).execute(
        {
          userId: "owner-2",
          roles: ["USER"],
          permissions: ["learning-request:create"],
        },
        "req-1",
        { expectedVersion: 1 },
      ),
    (error) => error?.getStatus?.() === 404,
  );
  await assert.rejects(
    () =>
      createUseCase({ ...request, status: "OPEN" }).execute(
        {
          userId: "owner-1",
          roles: ["USER"],
          permissions: ["learning-request:create"],
        },
        "req-1",
        { expectedVersion: 1 },
      ),
    (error) => error?.getStatus?.() === 409,
  );
});

test("publish refuses stale content or a moderation configuration changed during scanning", async () => {
  const now = new Date("2026-10-06T00:00:00Z");
  const baseRequest = {
    id: "req-1",
    ownerId: "owner-1",
    skillId: "skill-1",
    title: "Learn Vietnamese",
    description: "Practice speaking with a partner.",
    learningGoal: "Hold a short conversation.",
    currentLevel: null,
    verifiedTeacherOnly: false,
    status: "DRAFT",
    moderationStatus: "NOT_REQUIRED",
    version: 1,
    tagLinks: [],
    preferredSlots: [],
    requestedExpiresAt: null,
    expiresAt: null,
  };
  const ruleSet = { rules: [{ category: "TEST", pattern: "blocked phrase" }] };
  const makeUseCase = ({
    changeContent = false,
    changeConfig = false,
  } = {}) => {
    let configReads = 0;
    const writes = [];
    const useCase = new PublishLearningRequestUseCase(
      { run: async (work) => work({ $queryRaw: async () => [] }) },
      { assertUserAction: async (_tx, actor) => actor },
      { assertAllowed: async () => {} },
      {
        get: async () => baseRequest,
        lock: async () =>
          changeContent
            ? { ...baseRequest, title: "Changed during filter" }
            : baseRequest,
        databaseNow: async () => now,
        transition: async (_tx, id, version, from, values) => (
          writes.push(values),
          true
        ),
      },
      {
        assertActiveSelection: async (_tx, selection) => ({
          skillId: selection.skillId,
          tags: [],
        }),
      },
      {
        getSnapshot: async () => {
          configReads += 1;
          return {
            values: { "learningRequest.moderationRuleSet": ruleSet },
            versions: {
              "learningRequest.moderationRuleSet":
                changeConfig && configReads > 1 ? 2 : 1,
            },
            readAt: now,
          };
        },
      },
    );
    return { useCase, writes };
  };
  const actor = {
    userId: "owner-1",
    roles: ["USER"],
    permissions: ["learning-request:create"],
  };
  for (const options of [{ changeContent: true }, { changeConfig: true }]) {
    const { useCase, writes } = makeUseCase(options);
    await assert.rejects(
      () => useCase.execute(actor, "req-1", { expectedVersion: 1 }),
      (error) => error?.getStatus?.() === 409,
    );
    assert.equal(writes.length, 0);
  }
});
