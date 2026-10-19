import assert from "node:assert/strict";
import { test } from "node:test";
import { EditLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/edit-learning-request.use-case.js";

const now = new Date("2026-10-06T00:00:00.000Z");
const requestId = "22222222-2222-4222-8222-222222222222";
const ownerId = "11111111-1111-4111-8111-111111111111";
const skillId = "44444444-4444-4444-8444-444444444444";
const tagId = "55555555-5555-4555-8555-555555555555";
const moderationKey = "learningRequest.moderationRuleSet";

function request(status = "DRAFT", overrides = {}) {
  return {
    id: requestId,
    ownerId,
    skillId,
    title: "Learn backend engineering",
    description: "I want to improve my backend engineering skills.",
    learningGoal: "Build production-ready APIs with guidance.",
    currentLevel: "BEGINNER",
    verifiedTeacherOnly: false,
    status,
    moderationStatus:
      status === "PENDING_MODERATION"
        ? "PENDING"
        : status === "REJECTED"
          ? "REJECTED"
          : "NOT_REQUIRED",
    moderationRejectReason:
      status === "REJECTED" ? "Please clarify your goal" : null,
    flaggedCategories: status === "PENDING_MODERATION" ? ["TEST"] : [],
    moderationRuleSetVersion: status === "PENDING_MODERATION" ? 1 : null,
    moderationReviewedVersion: status === "REJECTED" ? 2 : null,
    moderatedByUserId:
      status === "REJECTED" ? "33333333-3333-4333-8333-333333333333" : null,
    moderatedAt: status === "REJECTED" ? now : null,
    requestedExpiresAt: null,
    expiresAt: status === "DRAFT" ? null : new Date("2026-10-31T00:00:00.000Z"),
    expiryMode: "DEFAULT",
    publishedAt:
      status === "DRAFT" ? null : new Date("2026-10-01T00:00:00.000Z"),
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
  sessionId: "66666666-6666-4666-8666-666666666666",
  securityVersion: 1,
  roles: ["USER"],
  permissions: ["learning-request:update:self"],
};

function harness(current = request(), options = {}) {
  let reads = 0;
  let configReads = 0;
  const writes = [];
  const tx = { $queryRaw: async () => [] };
  const access = {
    assertUserAction: async (_tx, actor, permission) => {
      assert.equal(permission, "learning-request:update:self");
      if (!actor.permissions.includes(permission))
        throw Object.assign(new Error(), { status: 403 });
      return actor;
    },
  };
  const catalog = {
    assertActiveSelection: async (_tx, selection) => ({
      skillId: selection.skillId,
      tags: selection.tagIds.map((id) => ({ id, label: `Tag ${id}` })),
    }),
  };
  const repository = {
    databaseNow: async () => now,
    get: async () => ((reads += 1), current),
    lock: async () => {
      reads += 1;
      if (options.staleAtCommit && reads > 1) current.version += 1;
      return current;
    },
    replaceContent: async (_tx, id, expectedVersion, content) => {
      writes.push({ id, expectedVersion, content });
      if (current.version !== expectedVersion) return false;
      const { tagIds, preferredSlots, ...fields } = content;
      Object.assign(current, fields, {
        version: current.version + 1,
        tagLinks: tagIds.map((tagId) => ({ requestId, tagId })),
        preferredSlots,
        updatedAt: now,
      });
      return true;
    },
  };
  const configuration = {
    getSnapshot: async () => {
      configReads += 1;
      return {
        values: {
          [moderationKey]: {
            rules: [{ category: "TEST", pattern: "flag this" }],
          },
        },
        versions: {
          [moderationKey]: options.configChange && configReads > 1 ? 2 : 1,
        },
      };
    },
  };
  return {
    current,
    writes,
    get configReads() {
      return configReads;
    },
    useCase: new EditLearningRequestUseCase(
      { run: (work) => work(tx) },
      access,
      catalog,
      repository,
      configuration,
    ),
  };
}

test("draft edit replaces selected fields and does not invoke moderation", async () => {
  const h = harness();
  const result = await h.useCase.execute(owner, requestId, {
    expectedVersion: 2,
    title: "Learn better backend engineering",
    tagIds: [tagId],
    verifiedTeacherOnly: true,
  });
  assert.equal(result.title, "Learn better backend engineering");
  assert.deepEqual(result.tagIds, [tagId]);
  assert.equal(result.status, "DRAFT");
  assert.equal(result.version, 3);
  assert.equal(result.verifiedTeacherOnly, true);
  assert.equal(h.configReads, 0);
});

test("published edits re-filter content, preserve the original expiry, and reset old review metadata", async () => {
  for (const [goal, expectedStatus, expectedModeration] of [
    [
      "Build reliable APIs while practicing with guidance.",
      "OPEN",
      "NOT_REQUIRED",
    ],
    [
      "Flag this learning request for staff review.",
      "PENDING_MODERATION",
      "PENDING",
    ],
  ]) {
    const current = request("OPEN");
    const originalExpiry = current.expiresAt;
    const h = harness(current);
    const result = await h.useCase.execute(owner, requestId, {
      expectedVersion: 2,
      learningGoal: goal,
    });
    assert.equal(result.status, expectedStatus);
    assert.equal(result.moderationStatus, expectedModeration);
    assert.equal(result.version, 3);
    assert.equal(result.expiresAt.toISOString(), originalExpiry.toISOString());
    assert.equal(h.writes[0].content.moderationReviewedVersion, null);
    assert.equal(h.writes[0].content.moderatedByUserId, null);
  }
});

test("editing a rejected request returns it to DRAFT and clears the current decision", async () => {
  const current = request("REJECTED");
  const previousExpiry = current.expiresAt;
  const h = harness(current);
  const result = await h.useCase.execute(owner, requestId, {
    expectedVersion: 2,
    description: "I want to improve backend API design with a mentor.",
  });
  assert.equal(result.status, "DRAFT");
  assert.equal(result.moderationStatus, "NOT_REQUIRED");
  assert.equal(result.moderationRejectReason, null);
  assert.equal(result.expiresAt.toISOString(), previousExpiry.toISOString());
  assert.equal(h.configReads, 0);
});

test("published skill is immutable and stale content/configuration cannot commit", async () => {
  for (const options of [{}, { staleAtCommit: true }, { configChange: true }]) {
    const h = harness(request("OPEN"), options);
    const input =
      options.staleAtCommit || options.configChange
        ? { expectedVersion: 2, title: "Learn another backend skill" }
        : {
            expectedVersion: 2,
            skillId: "77777777-7777-4777-8777-777777777777",
          };
    await assert.rejects(() => h.useCase.execute(owner, requestId, input));
    assert.equal(h.writes.length, 0);
  }
});

test("Negotiating and exact-deadline requests cannot be edited", async () => {
  const negotiating = harness(request("NEGOTIATING"));
  await assert.rejects(() =>
    negotiating.useCase.execute(owner, requestId, {
      expectedVersion: 2,
      title: "A changed request title",
    }),
  );
  const expired = harness(request("OPEN", { expiresAt: now }));
  await assert.rejects(() =>
    expired.useCase.execute(owner, requestId, {
      expectedVersion: 2,
      title: "A changed request title",
    }),
  );
  assert.equal(negotiating.writes.length, 0);
  assert.equal(expired.writes.length, 0);
});
