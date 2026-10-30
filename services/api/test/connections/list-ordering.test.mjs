import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ProposalsService } from "../../dist/modules/proposals/application/services/proposals.service.js";
import { ProposalQueryDto } from "../../dist/modules/proposals/presentation/http/proposals.dto.js";
import { SharingSkillsRepository } from "../../dist/modules/sharing-skills/infrastructure/persistence/sharing-skills.repository.js";
import { ConversationsService } from "../../dist/modules/conversations/application/services/conversations.service.js";
import { cursorScope } from "../../dist/modules/skills/domain/skill-policy.js";
import { backfillChatActivity } from "../../scripts/lib/chat-activity-backfill.mjs";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = (n) =>
  new Date(`2026-10-${String(n).padStart(2, "0")}T00:00:00.000Z`);
const viewer = id(100),
  other = id(101);

// Small generic query adapter: execute the generated predicates/order instead of
// returning a pre-sorted fixture that could conceal a broken cursor or ACL.
function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return value.every((part) => matches(row, part));
    if (key === "OR") return value.some((part) => matches(row, part));
    if (value instanceof Date) return row[key]?.getTime() === value.getTime();
    if (value && typeof value === "object") {
      if ("lt" in value) return row[key] < value.lt;
      if ("gt" in value) return row[key] > value.gt;
      return matches(row[key], value);
    }
    return row[key] === value;
  });
}
function findMany(rows) {
  return async ({ where, orderBy, take }) =>
    rows
      .filter((row) => matches(row, where))
      .sort((a, b) => {
        for (const order of Array.isArray(orderBy) ? orderBy : [orderBy]) {
          const [key, direction] = Object.entries(order)[0];
          const comparison = a[key] < b[key] ? -1 : Number(a[key] > b[key]);
          if (comparison)
            return direction === "desc" ? -comparison : comparison;
        }
        return 0;
      })
      .slice(0, take);
}
async function collect(list, query = {}) {
  const ids = [];
  let cursor;
  do {
    const result = await list({ ...query, limit: 1, cursor });
    ids.push(...result.data.map((row) => row.id));
    cursor = result.pagination.nextCursor;
  } while (cursor);
  return ids;
}

test("Proposal sent/received/all filters use one chronological keyset with timestamp ties", async () => {
  const rows = [
    { id: id(1), createdAt: time(29), proposerId: viewer, recipientId: other },
    { id: id(9), createdAt: time(28), proposerId: other, recipientId: viewer },
    { id: id(8), createdAt: time(28), proposerId: viewer, recipientId: other },
    { id: id(7), createdAt: time(27), proposerId: id(102), recipientId: other },
  ].map((row) => ({
    ...row,
    requestId: id(50),
    status: "PENDING",
    proposedCredit: null,
  }));
  const tx = { proposal: { findMany: findMany(rows) } };
  const service = new ProposalsService(
    {},
    { run: (work) => work(tx) },
    {},
    { require: async () => {} },
    {},
    { proposalSource: async () => ({ ownerId: viewer }) },
  );
  const list = (query) => service.list({ userId: viewer }, query);
  assert.deepEqual(await collect(list, { direction: "all" }), [
    id(1),
    id(9),
    id(8),
  ]);
  assert.deepEqual(await collect(list, { direction: "sent" }), [id(1), id(8)]);
  assert.deepEqual(await collect(list), [id(9)]);
  assert.deepEqual(
    await collect(list, {
      direction: "all",
      status: "PENDING",
      learningRequestId: id(50),
    }),
    [id(1), id(9), id(8)],
  );
  assert.deepEqual(
    await collect(list, { direction: "all", status: "ACCEPTED" }),
    [],
  );
  const first = await list({ direction: "all", limit: 1 });
  await assert.rejects(
    list({ direction: "sent", cursor: first.pagination.nextCursor }),
    /INVALID_CURSOR/,
  );
  const cursor = JSON.parse(
    Buffer.from(first.pagination.nextCursor, "base64url"),
  );
  cursor.value = "invalid-date";
  await assert.rejects(
    list({
      direction: "all",
      cursor: Buffer.from(JSON.stringify(cursor)).toString("base64url"),
    }),
    /INVALID_CURSOR/,
  );
  assert.equal(
    (await validate(plainToInstance(ProposalQueryDto, { direction: "all" })))
      .length,
    0,
  );
  service.requests.proposalSource = async () => ({ ownerId: other });
  await assert.rejects(
    list({ direction: "all", learningRequestId: id(50) }),
    (error) => error.getStatus() === 404,
  );
});

test("own/public skills stay newest first across pages and expose their own createdAt", async () => {
  const rows = [
    { id: id(1), createdAt: time(29) },
    { id: id(9), createdAt: time(28) },
    { id: id(8), createdAt: time(28) },
  ].map((row) => ({
    ...row,
    userId: viewer,
    archivedAt: null,
    isVisible: true,
    skillIdRecord: { status: "ACTIVE" },
    userIdRecord: { accountStatus: "ACTIVE" },
    skillVerificationSharingSkillIdRecords: [],
  }));
  const repository = new SharingSkillsRepository({
    sharingSkill: { findMany: findMany(rows) },
  });
  for (const publicOnly of [false, true]) {
    assert.deepEqual(
      await collect((query) => repository.list(viewer, query, publicOnly)),
      [id(1), id(9), id(8)],
    );
    const result = await repository.list(viewer, { limit: 1 }, publicOnly);
    assert.equal(result.data[0].createdAt, rows[0].createdAt);
  }
  rows[0].isVisible = false;
  assert.deepEqual(
    await collect((query) => repository.list(viewer, query, true)),
    [id(9), id(8)],
  );
  const legacy = Buffer.from(
    JSON.stringify({
      scope: cursorScope({
        type: "sharing",
        userId: viewer,
        publicOnly: false,
        archived: false,
      }),
      id: id(1),
      value: id(1),
    }),
  ).toString("base64url");
  await assert.rejects(
    repository.list(viewer, { limit: 1, cursor: legacy }),
    /INVALID_CURSOR/,
  );
});

test("activity ordering promotes a conversation from a later page on a fresh Inbox fetch", async () => {
  const rows = [
    { id: id(1), lastActivityAt: time(29) },
    { id: id(9), lastActivityAt: time(28) },
    { id: id(8), lastActivityAt: time(28) },
  ].map((row) => ({
    ...row,
    createdAt: time(20),
    requestId: id(50),
    participantAId: viewer,
    participantBId: other,
    proposalId: id(51),
  }));
  const tx = { conversation: { findMany: findMany(rows) } };
  const service = new ConversationsService(
    {},
    { run: (work) => work(tx) },
    {},
    { require: async () => {} },
    {},
    { inboxSummaries: async () => new Map() },
    {},
    {},
    {},
    {},
    { summaries: async () => new Map() },
    { read: async () => new Map() },
  );
  const list = (query) => service.list({ userId: viewer }, query);
  assert.deepEqual(await collect(list), [id(1), id(9), id(8)]);
  rows[2].lastActivityAt = time(30);
  const first = await list({ limit: 1 });
  assert.equal(first.data[0].id, id(8));
  assert.equal(first.data[0].lastActivityAt, rows[2].lastActivityAt);
  assert.equal(first.data[0].learningRequestId, id(50));
});

test("activity backfill is bounded, skips empty chats and preserves newer concurrent deliveries", async () => {
  const rows = [id(1), id(2), id(3)].map((id) => ({
    id,
    lastActivityAt: time(20),
  }));
  rows[1].lastActivityAt = time(30);
  const db = {
    conversation: {
      findMany: findMany(rows),
      updateMany: async ({ where, data }) => {
        const row = rows.find((row) => matches(row, where));
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
  };
  const mongo = {
    aggregate: (pipeline) => ({
      toArray: async () =>
        pipeline[0].$documents.map((row) => ({
          ...row,
          last: row._id === id(3) ? [] : [{ sentAt: time(29) }],
        })),
    }),
  };
  assert.deepEqual(await backfillChatActivity(db, mongo, 2), {
    scanned: 3,
    updated: 1,
  });
  assert.equal(rows[1].lastActivityAt.getTime(), time(30).getTime());
  assert.equal(rows[2].lastActivityAt.getTime(), time(20).getTime());
  assert.deepEqual(await backfillChatActivity(db, mongo, 2), {
    scanned: 3,
    updated: 0,
  });
});
