import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { backfillChatActivity } from "../../scripts/lib/chat-activity-backfill.mjs";
import { InboxGroupsRepository } from "../../dist/modules/conversations/infrastructure/persistence/inbox-groups.repository.js";
import { ProposalInboxReader } from "../../dist/modules/proposals/application/services/proposal-inbox.reader.js";
import { InboxGroupsService } from "../../dist/modules/conversations/application/services/inbox-groups.service.js";

export const inboxId = (n) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const ownerId = inboxId(100),
  senderId = inboxId(101),
  thirdId = inboxId(102);

export async function checkInboxActivityMigration(client) {
  await client.query(`CREATE TABLE conversations (
    conversation_id uuid PRIMARY KEY, participant_a_id uuid, participant_b_id uuid,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const createdAt = new Date("2026-01-02T03:04:05.123Z");
  await client.query(
    "INSERT INTO conversations (conversation_id, created_at) VALUES ($1,$2)",
    [inboxId(1), createdAt],
  );
  await client.query(
    readFileSync(
      new URL(
        "../../prisma/migrations/20261103000000_inbox_activity/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const legacy = (
    await client.query("SELECT created_at, last_activity_at FROM conversations")
  ).rows[0];
  assert.equal(
    new Date(legacy.last_activity_at).getTime(),
    createdAt.getTime(),
  );
  assert.equal(new Date(legacy.created_at).getTime(), createdAt.getTime());
  const fresh = (
    await client.query(
      "INSERT INTO conversations (conversation_id) VALUES ($1) RETURNING created_at, last_activity_at",
      [inboxId(2)],
    )
  ).rows[0];
  assert.equal(
    new Date(fresh.created_at).getTime(),
    new Date(fresh.last_activity_at).getTime(),
  );
  const indexes = (
    await client.query(
      "SELECT indexname FROM pg_indexes WHERE tablename='conversations' AND schemaname=current_schema()",
    )
  ).rows;
  for (const name of [
    "conversations_participant_a_activity_idx",
    "conversations_participant_b_activity_idx",
  ])
    assert(indexes.some((row) => row.indexname === name));
  // Run the production parameterized bulk update against the actual SQL engine.
  const newest = new Date("2026-12-01T00:00:00.000Z");
  await client.query(
    "UPDATE conversations SET last_activity_at=$1 WHERE conversation_id=$2",
    [newest, inboxId(2)],
  );
  const db = {
    conversation: {
      findMany: async ({ where, take }) =>
        (
          await client.query(
            "SELECT conversation_id AS id FROM conversations WHERE ($1::uuid IS NULL OR conversation_id>$1::uuid) ORDER BY conversation_id LIMIT $2",
            [where.id?.gt ?? null, take],
          )
        ).rows,
    },
    $executeRaw: async (sql) => {
      const result = await client.query(sql.text, sql.values);
      return result.rowCount ?? result.affectedRows;
    },
  };
  const mongo = {
    aggregate: (pipeline) => ({
      toArray: async () =>
        pipeline[0].$documents.map(({ _id }) => ({
          _id,
          last: [{ sentAt: new Date("2026-11-01T00:00:00.000Z") }],
        })),
    }),
  };
  assert.deepEqual(await backfillChatActivity(db, mongo, 2), {
    scanned: 2,
    updated: 1,
  });
  assert.deepEqual(await backfillChatActivity(db, mongo, 2), {
    scanned: 2,
    updated: 0,
  });
  const preserved = (
    await client.query(
      "SELECT last_activity_at FROM conversations WHERE conversation_id=$1",
      [inboxId(2)],
    )
  ).rows[0];
  assert.equal(
    new Date(preserved.last_activity_at).getTime(),
    newest.getTime(),
  );
  await client.query("DROP TABLE conversations");
}

/** Runs the production aggregate against PostgreSQL; no SQL-counting mock. */
export async function checkInboxGroupQueries(client) {
  await client.query(`CREATE TABLE proposals (
    proposal_id uuid PRIMARY KEY, request_id uuid, proposer_id uuid, recipient_id uuid,
    status text, created_at timestamptz(3) NOT NULL
  ); CREATE TABLE conversations (
    conversation_id uuid PRIMARY KEY, request_id uuid, proposal_id uuid,
    participant_a_id uuid, participant_b_id uuid, last_activity_at timestamptz(3) NOT NULL
  )`);
  let nextProposal = 200;
  async function propose(request, proposer, recipient, status, hour = 0) {
    const id = inboxId(nextProposal++);
    await client.query(`INSERT INTO proposals VALUES ($1,$2,$3,$4,$5,$6)`, [
      id,
      request && inboxId(request),
      proposer,
      recipient,
      status,
      new Date(`2026-11-03T0${hour}:00:00.000Z`),
    ]);
    return id;
  }
  async function chat(id, request, proposal, a, b, hour) {
    await client.query(`INSERT INTO conversations VALUES ($1,$2,$3,$4,$5,$6)`, [
      inboxId(id),
      request && inboxId(request),
      proposal,
      a,
      b,
      new Date(`2026-11-03T0${hour}:00:00.000Z`),
    ]);
  }
  const first = await propose(1, senderId, ownerId, "ACCEPTED");
  const second = await propose(1, thirdId, ownerId, "ACCEPTED");
  await propose(1, senderId, ownerId, "REJECTED");
  await propose(1, senderId, ownerId, "WITHDRAWN");
  await propose(1, thirdId, ownerId, "EXPIRED");
  await propose(2, thirdId, ownerId, "REJECTED", 2);
  await propose(2, senderId, ownerId, "WITHDRAWN", 2);
  await propose(3, senderId, ownerId, "PENDING", 1);
  await propose(4, thirdId, inboxId(103), "PENDING", 5); // unrelated, never visible
  const direct = await propose(null, ownerId, senderId, "ACCEPTED");
  await chat(10, 1, first, ownerId, senderId, 3);
  await chat(11, 1, second, thirdId, ownerId, 3);
  await chat(12, 1, second, thirdId, inboxId(103), 4); // not this viewer's chat
  await chat(1, null, direct, ownerId, senderId, 0); // same UUID as Request group

  const tx = {
    $queryRaw: async (sql) => (await client.query(sql.text, sql.values)).rows,
  };
  const repository = new InboxGroupsRepository();
  const projection = new ProposalInboxReader();
  const requests = {
    read: async (_tx, _viewer, ids) =>
      new Map(ids.map((id) => [id, { title: "Closed Request", ownerId }])),
  };
  const service = new InboxGroupsService(
    { run: (work) => work(tx) },
    { require: async () => {} },
    repository,
    projection,
    requests,
    { read: async () => new Map([[direct, "Direct skill"]]) },
    {
      read: async (_principal, groups) =>
        new Map(
          groups.map((group) => [
            group.id,
            { latestMessage: null, hasUnread: false },
          ]),
        ),
    },
  );
  const owner = await service.list({ userId: ownerId }, { limit: 1 });
  assert.equal(owner.data.length, 1);
  assert.equal(owner.data[0].learningRequestId, inboxId(1));
  assert.equal(owner.data[0].receivedProposalCount, 5); // not multiplied by 2 chats
  assert.equal(owner.data[0].conversationCount, 2); // excludes third-party chat
  assert.equal(owner.data[0].viewerRole, "OWNER");
  assert.equal(owner.data[0].title, "Closed Request");
  const keys = [];
  let cursor;
  // Each request consumes the previous response's cursor; parallel requests
  // would stop testing the pagination chain.
  do {
    const page = await service.list({ userId: ownerId }, { limit: 1, cursor });
    keys.push(page.data[0].id);
    cursor = page.pagination.nextCursor;
  } while (cursor);
  assert.deepEqual(
    keys,
    [1, 2, 3]
      .map((id) => `request:${inboxId(id)}`)
      .concat(`conversation:${inboxId(1)}`),
  );
  const receivedOnly = await service.list({ userId: ownerId }, { limit: 100 });
  assert.equal(
    receivedOnly.data.find((row) => row.learningRequestId === inboxId(2))
      .receivedProposalCount,
    2,
  );
  assert.equal(
    receivedOnly.data.find((row) => row.learningRequestId === inboxId(2))
      .conversationCount,
    0,
  );
  assert.equal(
    receivedOnly.data.find((row) => row.learningRequestId === inboxId(3))
      .conversationCount,
    0,
  );
  const sender = await service.list({ userId: senderId }, { limit: 100 });
  assert.equal(sender.data.length, 2); // Request 1 + direct chat; pending-only 2/3 stay in Sent
  const request = sender.data.find((row) => row.learningRequestId);
  assert.equal(request.conversationCount, 1);
  assert.equal(request.sentProposalCount, 3);
  assert.equal(request.receivedProposalCount, null); // no competitors' totals
  assert.equal(request.viewerRole, "PROPOSER");
  const directGroup = sender.data.find(
    (row) => row.groupType === "DIRECT_CONVERSATION",
  );
  assert.equal(directGroup.title, "Direct skill");
  assert.equal(directGroup.conversationId, inboxId(1));
  assert.equal(directGroup.receivedProposalCount, null);
  await assert.rejects(
    service.list({ userId: senderId }, { cursor: owner.pagination.nextCursor }),
    /INVALID_CURSOR/,
  );
  assert.deepEqual((await service.list({ userId: inboxId(199) }, {})).data, []);
  // Equal activity timestamps still paginate every group exactly once.
  await client.query("UPDATE proposals SET created_at = $1", [
    new Date("2026-11-03T06:00:00.000Z"),
  ]);
  const tied = [];
  cursor = undefined;
  // Recheck the same dependent cursor chain with timestamp ties.
  do {
    const page = await service.list({ userId: ownerId }, { limit: 1, cursor });
    tied.push(page.data[0].id);
    cursor = page.pagination.nextCursor;
  } while (cursor);
  assert.equal(new Set(tied).size, 4);
  assert.deepEqual(
    tied.slice(0, 3),
    [3, 2, 1].map((id) => `request:${inboxId(id)}`),
  );
  return {
    ownerGroups: keys.length,
    ownerReceivedHistory: 5,
    ownerChats: 2,
    senderChats: 1,
  };
}
