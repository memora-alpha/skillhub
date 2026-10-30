import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { ConversationsService } from "../../dist/modules/conversations/application/services/conversations.service.js";
import { ProfileReader } from "../../dist/modules/users/application/services/profile-reader.service.js";
import { PrismaUsersRepository } from "../../dist/modules/users/infrastructure/persistence/prisma-users-repository.js";

function fixture({ outage = false, revoked = false } = {}) {
  const userId = randomUUID(),
    partnerId = randomUUID();
  const rows = [0, 1].map((index) => ({
    id: randomUUID(),
    proposalId: randomUUID(),
    requestId: index === 0 ? randomUUID() : null,
    participantAId: userId,
    participantBId: partnerId,
    createdAt: new Date(),
    lastActivityAt: new Date(),
  }));
  const calls = { profiles: 0, topics: 0, summaries: 0, authorized: 0 };
  const tx = {
    conversation: {
      findMany: async (query) => {
        assert.deepEqual(query.where.OR, [
          { participantAId: userId },
          { participantBId: userId },
        ]);
        assert.equal(query.take, 21);
        return rows;
      },
    },
  };
  const service = new ConversationsService(
    {},
    { run: (work) => work(tx) },
    {
      require: async (_tx, _principal, id) => ({
        conversation: rows.find((row) => row.id === id),
      }),
    },
    {
      require: async () => {
        calls.authorized++;
        if (revoked && calls.authorized === 2)
          throw new Error("session revoked");
      },
    },
    {},
    {
      inboxSummaries: async (ids, viewer) => {
        calls.summaries++;
        assert.deepEqual(
          ids,
          rows.map((row) => row.id),
        );
        assert.equal(viewer, userId);
        if (outage) throw new Error("Mongo unavailable");
        return new Map([
          [
            rows[0].id,
            {
              unreadCount: 3,
              lastMessage: {
                id: "preview",
                messageText: "hello",
                senderId: partnerId,
              },
            },
          ],
          [rows[1].id, { unreadCount: 0, lastMessage: null }],
        ]);
      },
    },
    {},
    {},
    {},
    {},
    {
      summaries: async (ids) => {
        calls.profiles++;
        assert(ids.every((id) => id === partnerId || id === userId));
        return new Map([
          [
            partnerId,
            { userId: partnerId, fullName: "Partner", avatarUrl: null },
          ],
        ]);
      },
    },
    {
      read: async (_tx, ids) => {
        calls.topics++;
        assert.equal(ids.length, 2);
        return new Map(ids.map((id) => [id, "Skill topic"]));
      },
    },
  );
  return { service, principal: { userId }, calls, rows };
}

test("Inbox batches the authorized page and rechecks authorization after chat I/O", async () => {
  const f = fixture();
  const result = await f.service.list(f.principal, {});
  assert.deepEqual(f.calls, {
    profiles: 1,
    topics: 1,
    summaries: 1,
    authorized: 2,
  });
  assert.equal(result.data[0].partner.fullName, "Partner");
  assert.equal(result.data[0].learningRequestId, f.rows[0].requestId);
  assert.equal(result.data[1].learningRequestId, null);
  assert.equal(result.data[0].topic, "Skill topic");
  assert.equal(result.data[0].unreadCount, 3);
  assert.equal(result.data[0].summaryAvailable, true);
  assert.deepEqual(result.data[0].lastMessage.sender, {
    id: f.rows[0].participantBId,
    fullName: "Partner",
    avatarUrl: null,
  });
  assert.equal(result.data[1].unreadCount, 0);
  assert.equal(result.data[1].lastMessage, null);
  assert.equal(result.pagination.hasMore, false);
  const revoked = fixture({ revoked: true });
  await assert.rejects(
    revoked.service.list(revoked.principal, {}),
    /session revoked/,
  );
});

test("Inbox preserves dev Conversation metadata for request and direct conversations", async () => {
  const f = fixture();
  const result = await f.service.list(f.principal, {});
  for (const [index, row] of f.rows.entries()) {
    const detail = await f.service.get(f.principal, row.id);
    const metadata = {
      id: row.id,
      proposalId: row.proposalId,
      learningRequestId: row.requestId,
      participantAId: row.participantAId,
      participantBId: row.participantBId,
      createdAt: row.createdAt,
    };
    assert.deepEqual(detail, metadata);
    for (const [key, value] of Object.entries(metadata))
      assert.deepEqual(result.data[index][key], value);
  }
});

test("Mongo outage keeps Conversations visible and distinguishes unknown unread from zero", async () => {
  const f = fixture({ outage: true });
  const result = await f.service.list(f.principal, {});
  assert.equal(result.data.length, 2);
  for (const [index, row] of result.data.entries()) {
    assert.equal(row.learningRequestId, f.rows[index].requestId);
    assert.equal(row.summaryAvailable, false);
    assert.equal(row.unreadCount, null);
    assert.equal(row.lastMessage, null);
  }
});

test("public partner projection signs only CLEAN avatars and never returns storage keys or emails", async () => {
  const signed = [];
  const rows = [
    {
      id: "clean",
      fullName: "Clean",
      selectedAvatarRecord: { state: "CLEAN", storageKey: "private/clean" },
    },
    {
      id: "quarantined",
      fullName: "Hidden avatar",
      selectedAvatarRecord: {
        state: "QUARANTINED",
        storageKey: "private/quarantine",
      },
    },
  ];
  let query;
  const db = {
    user: {
      findMany: async (args) => {
        query = args;
        return rows;
      },
    },
  };
  const reader = new ProfileReader(db, new PrismaUsersRepository(), {
    url: async (key) => {
      signed.push(key);
      return "https://signed.example/avatar";
    },
  });
  const result = await reader.summaries(["clean", "quarantined", "clean"]);
  assert.equal(query.where.accountStatus, "ACTIVE");
  assert.deepEqual(query.where.id.in, ["clean", "quarantined"]);
  assert(!query.select.normalizedEmail && !query.select.passwordHash);
  assert.deepEqual(signed, ["private/clean"]);
  assert.equal(result.get("quarantined").avatarUrl, null);
  assert(!JSON.stringify([...result.values()]).includes("storageKey"));
  assert(!JSON.stringify([...result.values()]).includes("private/"));
});
