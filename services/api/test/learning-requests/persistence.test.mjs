import assert from "node:assert/strict";
import { test } from "node:test";
import { PrismaLearningRequestRepository } from "../../dist/modules/learning-requests/infrastructure/persistence/prisma-learning-request.repository.js";

const requestId = "11111111-1111-4111-8111-111111111111";
const baseRow = {
  id: requestId,
  ownerId: "22222222-2222-4222-8222-222222222222",
  skillId: "33333333-3333-4333-8333-333333333333",
  title: "Learn Vietnamese cooking",
  description: "I want to learn to prepare several traditional dishes.",
  learningGoal: "Prepare a complete family meal.",
  currentLevel: null,
  verifiedTeacherOnly: false,
  status: "DRAFT",
  moderationStatus: "NOT_REQUIRED",
  moderationRejectReason: null,
  flaggedCategories: [],
  moderationRuleSetVersion: null,
  moderationReviewedVersion: null,
  moderatedByUserId: null,
  moderatedAt: null,
  expiresAt: null,
  expiryMode: "DEFAULT",
  publishedAt: null,
  version: 1,
  createdAt: new Date("2026-10-06T00:00:00Z"),
  updatedAt: new Date("2026-10-06T00:00:00Z"),
  preferredSlots: [],
  tagLinks: [],
};

const repository = () => new PrismaLearningRequestRepository({});

test("get includes preferred slots and canonical tag IDs", async () => {
  const tx = {
    learningRequest: {
      findUnique: async (query) => {
        assert.deepEqual(query.where, { id: requestId });
        assert.deepEqual(query.include, {
          tagLinks: true,
        });
        return baseRow;
      },
    },
  };

  assert.deepEqual(await repository().get(tx, requestId), baseRow);
});

test("lock issues FOR UPDATE before loading the request", async () => {
  const statements = [];
  const tx = {
    $queryRaw: async (strings, ...values) => {
      statements.push({ sql: strings.join("?"), values });
      return [{ id: requestId }];
    },
    learningRequest: { findUnique: async () => baseRow },
  };

  assert.deepEqual(await repository().lock(tx, requestId), baseRow);
  assert.match(statements[0].sql, /FOR UPDATE/i);
  assert.deepEqual(statements[0].values, [requestId]);
});

test("a stale version cannot replace content or child rows", async () => {
  const calls = [];
  const tx = {
    learningRequest: {
      updateMany: async (query) => (calls.push(query), { count: 0 }),
    },
    requestTag: { deleteMany: async () => calls.push("delete tags") },
  };

  assert.equal(
    await repository().replaceContent(tx, requestId, 4, {
      title: "Revised request",
      tagIds: [],
      preferredSlots: [],
    }),
    false,
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].where, { id: requestId, version: 4 });
});

test("content replacement increments version and replaces supplied collections", async () => {
  const calls = [];
  const tx = {
    learningRequest: {
      updateMany: async (query) => (calls.push(query), { count: 1 }),
    },
    requestTag: {
      deleteMany: async (query) => calls.push(["delete tags", query]),
      createMany: async (query) => calls.push(["create tags", query]),
    },
  };
  const preferredSlots = [
    { startAt: new Date(), endAt: new Date(Date.now() + 60_000) },
  ];

  assert.equal(
    await repository().replaceContent(tx, requestId, 3, {
      title: "Revised request",
      tagIds: ["44444444-4444-4444-8444-444444444444"],
      preferredSlots,
    }),
    true,
  );
  assert.deepEqual(calls[0].where, { id: requestId, version: 3 });
  assert.equal(calls[0].data.version.increment, 1);
  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls[0].data.preferredSlots,
    preferredSlots.map((slot) => ({
      startAt: slot.startAt.toISOString(),
      endAt: slot.endAt.toISOString(),
    })),
  );
  assert.equal(calls.at(-1)[0], "create tags");
});

test("JSON preferred slots round-trip as UTC dates and malformed stored slots fail closed", async () => {
  const stored = {
    ...baseRow,
    preferredSlots: [
      {
        startAt: "2026-10-08T01:00:00+07:00",
        endAt: "2026-10-08T02:00:00+07:00",
      },
    ],
    flaggedCategories: ["TEST"],
    verifiedTeacherOnly: true,
  };
  const tx = { learningRequest: { findUnique: async () => stored } };
  const result = await repository().get(tx, requestId);
  assert.equal(
    result.preferredSlots[0].startAt.toISOString(),
    "2026-10-07T18:00:00.000Z",
  );
  assert.equal(
    result.preferredSlots[0].endAt.toISOString(),
    "2026-10-07T19:00:00.000Z",
  );
  assert.equal(result.verifiedTeacherOnly, true);
  assert.deepEqual(result.flaggedCategories, ["TEST"]);
  stored.preferredSlots = [{ startAt: "invalid", endAt: "invalid" }];
  await assert.rejects(() => repository().get(tx, requestId));
});

test("status transitions require an expected version and allowed source state", async () => {
  let query;
  const tx = {
    learningRequest: {
      updateMany: async (input) => ((query = input), { count: 1 }),
    },
  };

  assert.equal(
    await repository().transition(tx, requestId, 2, ["DRAFT", "REJECTED"], {
      status: "PENDING_MODERATION",
    }),
    true,
  );
  assert.deepEqual(query.where, {
    id: requestId,
    version: 2,
    status: { in: ["DRAFT", "REJECTED"] },
  });
  assert.equal(query.data.version.increment, 1);
});

test("expiry scans are bounded and exclude states outside the accepted policy", async () => {
  let query;
  const tx = {
    learningRequest: { findMany: async (input) => ((query = input), []) },
  };
  const now = new Date("2026-10-06T00:00:00Z");

  await repository().findExpired(tx, now, 25);

  assert.deepEqual(query.where, {
    status: { in: ["OPEN", "PENDING_MODERATION"] },
    expiresAt: { lte: now },
  });
  assert.equal(query.take, 25);
  assert.deepEqual(query.orderBy, [{ expiresAt: "asc" }, { id: "asc" }]);
});
