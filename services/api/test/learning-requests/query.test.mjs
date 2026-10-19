import assert from "node:assert/strict";
import { test } from "node:test";
import { ListLearningRequestsUseCase } from "../../dist/modules/learning-requests/application/use-cases/list-learning-requests.use-case.js";

const actorId = "11111111-1111-4111-8111-111111111111";
const otherOwnerId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const skillId = "44444444-4444-4444-8444-444444444444";
const tagId = "55555555-5555-4555-8555-555555555555";
const now = new Date("2026-10-07T00:00:00.000Z");

function record(overrides = {}) {
  return {
    id: requestId,
    ownerId: otherOwnerId,
    skillId,
    title: "Learn backend engineering",
    description: "I want to improve my backend engineering skills.",
    learningGoal: "Build production-ready APIs with guidance.",
    currentLevel: "BEGINNER",
    verifiedTeacherOnly: false,
    status: "OPEN",
    moderationStatus: "NOT_REQUIRED",
    moderationRejectReason: null,
    flaggedCategories: [],
    moderationRuleSetVersion: 1,
    moderationReviewedVersion: null,
    moderatedByUserId: null,
    moderatedAt: null,
    requestedExpiresAt: null,
    expiresAt: new Date("2026-11-06T00:00:00.000Z"),
    expiryMode: "DEFAULT",
    publishedAt: new Date("2026-10-07T00:00:00.000Z"),
    version: 2,
    createdAt: now,
    updatedAt: now,
    preferredSlots: [],
    tagLinks: [{ requestId, tagId }],
    passwordHash: "must-not-project",
    ...overrides,
  };
}

const actor = {
  userId: actorId,
  sessionId: "66666666-6666-4666-8666-666666666666",
  securityVersion: 1,
  roles: ["USER"],
  permissions: ["learning-request:read", "learning-request:moderation:read"],
};

function harness(options = {}) {
  const calls = {
    access: [],
    page: [],
    recommended: [],
    catalogs: [],
    owners: [],
  };
  const tx = { $queryRaw: async () => [] };
  const access = {
    assertAction: async (_tx, currentActor, permission) => {
      calls.access.push(permission);
      if (!currentActor.permissions.includes(permission))
        throw Object.assign(new Error(), { status: 403 });
      return currentActor;
    },
  };
  const repository = {
    databaseNow: async () => now,
    findPage: async (_tx, filter) => {
      calls.page.push(filter);
      return options.pages?.shift?.() ?? [record()];
    },
    findRecommended: async (_tx, filter) => {
      calls.recommended.push(filter);
      return options.recommended ?? [{ request: record(), matchScore: 2 }];
    },
    get: async () => options.detail ?? record(),
  };
  const catalog = {
    readSelections: async (_tx, selection) => {
      calls.catalogs.push(selection);
      return {
        skills: selection.skillIds.map((id) => ({
          id,
          name: "Backend engineering",
        })),
        tags: selection.tagIds.map((id) => ({ id, label: "API design" })),
      };
    },
  };
  const owners = {
    readPublicOwners: async (_tx, ids) => {
      calls.owners.push(ids);
      return ids.map((id) => ({ id, displayName: "Learner" }));
    },
  };
  const sharing = {
    getMatchingSnapshot: async () => {
      if (options.sharingError)
        throw Object.assign(new Error("Sharing Skill unavailable"), {
          status: 503,
        });
      return {
        skillIds: [skillId],
        tagIds: [tagId],
        version: options.sharingVersion ?? "share-v4",
      };
    },
  };
  return {
    calls,
    useCase: new ListLearningRequestsUseCase(
      { run: (work) => work(tx) },
      access,
      repository,
      catalog,
      owners,
      sharing,
    ),
  };
}

test("FEED is OPEN/unexpired and returns only the public allowlist projection", async () => {
  const { calls, useCase } = harness();
  const page = await useCase.execute(actor, "FEED", {});
  assert.deepEqual(calls.access, ["learning-request:read"]);
  assert.deepEqual(calls.page[0].statuses, ["OPEN"]);
  assert.equal(calls.page[0].ownerId, undefined);
  assert.equal(calls.page[0].now, now);
  assert.equal(page.items[0].skill.name, "Backend engineering");
  assert.equal(page.items[0].tags[0].label, "API design");
  assert.equal(page.items[0].owner.displayName, "Learner");
  assert.equal("description" in page.items[0], true);
  assert.equal("offeredSharingSkillIds" in page.items[0], false);
  assert.equal("passwordHash" in page.items[0], false);
});

test("MINE is always scoped to Principal and returns owner-only moderation reason", async () => {
  const privateRequest = record({
    ownerId: actorId,
    status: "REJECTED",
    moderationStatus: "REJECTED",
    moderationRejectReason: "Please clarify your learning goal",
  });
  const { calls, useCase } = harness({ pages: [[privateRequest]] });
  const page = await useCase.execute(actor, "MINE", {});
  assert.equal(calls.page[0].ownerId, actorId);
  assert.equal(
    page.items[0].moderationRejectReason,
    "Please clarify your learning goal",
  );
  assert.equal("passwordHash" in page.items[0], false);
  assert.equal(calls.catalogs.length, 0);
  assert.equal(calls.owners.length, 0);
});

test("moderation queue is fixed to pending and requires its own explicit permission", async () => {
  const pending = record({
    status: "PENDING_MODERATION",
    moderationStatus: "PENDING",
  });
  const staffActor = { ...actor, roles: ["STAFF"] };
  const { calls, useCase } = harness({ pages: [[pending]] });
  const page = await useCase.execute(staffActor, "MODERATION", {});
  assert.deepEqual(calls.access, ["learning-request:moderation:read"]);
  assert.deepEqual(calls.page[0].statuses, ["PENDING_MODERATION"]);
  assert.equal(page.items[0].moderationStatus, "PENDING");
  assert.equal("passwordHash" in page.items[0], false);
  await assert.rejects(() =>
    useCase.execute({ ...staffActor, permissions: [] }, "MODERATION", {}),
  );
});

test("status cannot broaden FEED or MODERATION scope; MINE filters stay owner-bound", async () => {
  const { calls, useCase } = harness();
  await assert.rejects(() =>
    useCase.execute(actor, "FEED", { status: "DRAFT" }),
  );
  await assert.rejects(() =>
    useCase.execute(actor, "MODERATION", { status: "OPEN" }),
  );
  await useCase.execute(actor, "MINE", { status: "DRAFT" });
  assert.equal(calls.page.length, 1);
  assert.equal(calls.page[0].ownerId, actorId);
  assert.deepEqual(calls.page[0].statuses, ["DRAFT"]);
});

test("MINE status filtering uses effective expiry at the exact backend deadline", async () => {
  const { calls, useCase } = harness();
  await useCase.execute(actor, "MINE", { status: "EXPIRED" });
  assert.deepEqual(calls.page[0].statuses, [
    "EXPIRED",
    "OPEN",
    "PENDING_MODERATION",
  ]);
  assert.equal(calls.page[0].expiredAtOrBefore, now);
  await useCase.execute(actor, "MINE", { status: "OPEN" });
  assert.deepEqual(calls.page[1].statuses, ["OPEN"]);
  assert.equal(calls.page[1].now, now);
});

test("tag filtering is ANY-match and keyword wildcard characters remain literal", async () => {
  const { calls, useCase } = harness();
  await useCase.execute(actor, "FEED", {
    tagIds: [tagId],
    keyword: "API_%\\",
  });
  assert.deepEqual(calls.page[0].tagIds, [tagId]);
  assert.equal(calls.page[0].keyword, "API_%\\");
});

test("cursor binds scope, actor and filters; mismatches restart with 400", async () => {
  const pages = [
    [
      record({ id: requestId }),
      record({ id: "77777777-7777-4777-8777-777777777777" }),
    ],
    [record({ id: "88888888-8888-4888-8888-888888888888" })],
  ];
  const { calls, useCase } = harness({ pages });
  const first = await useCase.execute(actor, "FEED", {
    limit: 1,
    keyword: "backend",
  });
  assert.ok(first.nextCursor);
  const next = await useCase.execute(actor, "FEED", {
    limit: 1,
    keyword: "backend",
    cursor: first.nextCursor,
  });
  assert.equal(next.items.length, 1);
  assert.deepEqual(calls.page[1].after, { createdAt: now, id: requestId });
  await assert.rejects(() =>
    useCase.execute(actor, "MINE", {
      limit: 1,
      keyword: "backend",
      cursor: first.nextCursor,
    }),
  );
  await assert.rejects(() =>
    useCase.execute({ ...actor, userId: otherOwnerId }, "FEED", {
      limit: 1,
      keyword: "backend",
      cursor: first.nextCursor,
    }),
  );
  await assert.rejects(() =>
    useCase.execute(actor, "FEED", {
      limit: 1,
      keyword: "different",
      cursor: first.nextCursor,
    }),
  );
});

test("RECOMMENDED ranks skill and distinct tag matches, excludes own and requires snapshot", async () => {
  const ranked = [
    {
      request: record({ id: "88888888-8888-4888-8888-888888888888" }),
      matchScore: 3,
    },
    {
      request: record({ id: "99999999-9999-4999-8999-999999999999" }),
      matchScore: 1,
    },
  ];
  const { calls, useCase } = harness({ recommended: ranked });
  const page = await useCase.execute(actor, "RECOMMENDED", {});
  assert.deepEqual(calls.recommended[0].candidateSkillIds, [skillId]);
  assert.deepEqual(calls.recommended[0].candidateTagIds, [tagId]);
  assert.equal(calls.recommended[0].excludeOwnerId, actorId);
  assert.deepEqual(
    page.items.map((item) => item.matchScore),
    [3, 1],
  );
  const unavailable = harness({ sharingError: true });
  await assert.rejects(
    () => unavailable.useCase.execute(actor, "RECOMMENDED", {}),
    (error) => error.status === 503,
  );
});

test("recommended cursor restarts when the Sharing Skill snapshot changes", async () => {
  const first = harness({
    recommended: [
      { request: record({ id: requestId }), matchScore: 2 },
      {
        request: record({ id: "88888888-8888-4888-8888-888888888888" }),
        matchScore: 1,
      },
    ],
  });
  const page = await first.useCase.execute(actor, "RECOMMENDED", { limit: 1 });
  assert.ok(page.nextCursor);
  const changedSnapshot = harness({ sharingVersion: "share-v5" });
  await assert.rejects(
    () =>
      changedSnapshot.useCase.execute(actor, "RECOMMENDED", {
        limit: 1,
        cursor: page.nextCursor,
      }),
    (error) => error.getStatus?.() === 400,
  );
});
