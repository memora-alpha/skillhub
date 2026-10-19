import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../../dist/generated/prisma/client.js";
import { PrismaLearningRequestRepository } from "../../dist/modules/learning-requests/infrastructure/persistence/prisma-learning-request.repository.js";

const requestId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const skillId = "33333333-3333-4333-8333-333333333333";
const tagId = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-10-07T00:00:00.000Z");

test("page query uses combined scope, literal escaped keyword and stable seek ordering", async () => {
  let captured;
  const repository = new PrismaLearningRequestRepository({
    learningRequest: { findMany: async () => [] },
  });
  const tx = {
    learningRequest: {
      findMany: async (query) => {
        captured = query;
        return [];
      },
    },
  };
  await repository.findPage(tx, {
    statuses: ["OPEN"],
    ownerId,
    skillId,
    tagIds: [tagId],
    keyword: "a_%\\",
    now,
    after: { createdAt: now, id: requestId },
    take: 21,
  });
  assert.deepEqual(captured.where.status.in, ["OPEN"]);
  assert.equal(captured.where.ownerId, ownerId);
  assert.equal(captured.where.skillId, skillId);
  assert.deepEqual(captured.where.tagLinks.some.tagId.in, [tagId]);
  assert.deepEqual(captured.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  assert.equal(captured.where.OR[0].title.contains, "a\\_\\%\\\\");
  assert.equal(captured.where.expiresAt.gt, now);
  assert.equal(captured.take, 21);
});

test("recommendation ranking binds user input and uses distinct tags plus a stable score cursor", async () => {
  let sql;
  let values;
  const hydrated = [];
  const tx = {
    async $queryRaw(strings, ...interpolations) {
      const query = Prisma.sql(strings, ...interpolations);
      sql = query.sql;
      values = query.values;
      return [{ id: requestId, matchScore: 2, createdAt: now }];
    },
    learningRequest: {
      findMany: async (query) => {
        hydrated.push(query);
        return [
          {
            id: requestId,
            title: "ranked",
            preferredSlots: [],
            flaggedCategories: [],
          },
        ];
      },
    },
  };
  const repository = new PrismaLearningRequestRepository({
    learningRequest: tx.learningRequest,
  });
  const result = await repository.findRecommended(tx, {
    candidateSkillIds: [skillId],
    candidateTagIds: [tagId],
    excludeOwnerId: ownerId,
    skillId,
    tagIds: [tagId],
    keyword: "x' OR TRUE --",
    now,
    after: { matchScore: 2, createdAt: now, id: requestId },
    take: 21,
  });
  assert.match(sql, /COUNT\(DISTINCT request_tag\."tag_id"\)/);
  assert.match(sql, /match_score DESC, created_at DESC, request_id DESC/);
  assert.match(sql, /POSITION\(LOWER\(\?/);
  assert.match(sql, /WHERE match_score < \?/);
  assert.equal(sql.includes("x' OR TRUE --"), false);
  assert.ok(values.includes("x' OR TRUE --"));
  assert.equal(hydrated[0].where.id.in[0], requestId);
  assert.equal(result[0].matchScore, 2);
});
