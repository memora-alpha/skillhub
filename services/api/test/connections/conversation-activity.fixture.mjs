import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  recoverInboxActivity,
  inboxActivityMigration,
} from "../../scripts/lib/recover-inbox-activity.mjs";

const migrations = new URL("../../prisma/migrations/", import.meta.url);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const activitySql = await readFile(
  new URL(`${inboxActivityMigration}/migration.sql`, migrations),
  "utf8",
);
const guardSql = await readFile(
  new URL(
    "20261102235959_conversation_activity_guard/migration.sql",
    migrations,
  ),
  "utf8",
);

export async function prepareLegacyConversation(client) {
  await client.query(`CREATE TABLE proposals (
    proposal_id uuid PRIMARY KEY, status text, proposer_id uuid, recipient_id uuid, request_id uuid
  ); CREATE TABLE conversations (
    conversation_id uuid PRIMARY KEY, proposal_id uuid NOT NULL, request_id uuid,
    participant_a_id uuid NOT NULL, participant_b_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const connections = await readFile(
    new URL("20261009010000_connections/migration.sql", migrations),
    "utf8",
  );
  // Install the actual published guard, rather than a mock that permits UPDATE.
  await client.query(
    connections.slice(
      connections.indexOf("CREATE FUNCTION skillhub_guard_conversation()"),
      connections.indexOf("CREATE FUNCTION skillhub_guard_chat_publication()"),
    ),
  );
  await client.query(
    "INSERT INTO proposals VALUES ($1,'ACCEPTED',$2,$3,NULL)",
    [id(1), id(2), id(3)],
  );
  await client.query(
    `INSERT INTO conversations VALUES ($1,$2,NULL,$3,$4,'2026-01-02T03:04:05.123Z')`,
    [id(4), id(1), id(2), id(3)],
  );
}

async function assertConversationProtection(client) {
  for (const [column, value] of [
    ["conversation_id", id(5)],
    ["proposal_id", id(5)],
    ["request_id", id(5)],
    ["participant_a_id", id(5)],
    ["participant_b_id", id(5)],
    ["created_at", new Date("2026-02-01T00:00:00Z")],
  ]) {
    // Each rejection must leave the same immutable row available for the next check.
    await assert.rejects(
      client.query(
        `UPDATE conversations SET ${column}=$1,
      last_activity_at=CURRENT_TIMESTAMP WHERE conversation_id=$2`,
        [value, id(4)],
      ),
      /Conversation membership is immutable/,
    );
  }
  await assert.rejects(
    client.query(
      `INSERT INTO conversations
    (conversation_id,proposal_id,participant_a_id,participant_b_id)
    VALUES ($1,$2,$3,$4)`,
      [id(6), id(1), id(3), id(2)],
    ),
    /requires its accepted proposal/,
  );
  // Valid inserts and no-op updates still work, including a nullable Request.
  await client.query(
    `INSERT INTO conversations
    (conversation_id,proposal_id,participant_a_id,participant_b_id)
    VALUES ($1,$2,$3,$4)`,
    [id(6), id(1), id(2), id(3)],
  );
  await client.query(
    "UPDATE conversations SET request_id=request_id WHERE conversation_id=$1",
    [id(4)],
  );
}

export async function checkConversationActivityGuard(client) {
  await prepareLegacyConversation(client);
  await client.query("BEGIN");
  try {
    await assert.rejects(
      client.query(activitySql),
      /Conversation membership is immutable/,
    );
  } finally {
    await client.query("ROLLBACK");
  }
  // A forward-only dependency fixes the populated legacy table before backfill.
  await client.query(guardSql);
  await client.query(activitySql);
  const { rows } = await client.query(
    "SELECT created_at,last_activity_at FROM conversations",
  );
  assert.equal(
    +new Date(rows[0].created_at),
    +new Date(rows[0].last_activity_at),
  );
  await client.query(
    "UPDATE conversations SET last_activity_at=$1 WHERE conversation_id=$2",
    [new Date("2026-11-04T00:00:00Z"), id(4)],
  );
  await assertConversationProtection(client);
}

export async function checkConversationActivityRecovery(client, schema) {
  await prepareLegacyConversation(client);
  await client.query(`CREATE TABLE _prisma_migrations (
    id text PRIMARY KEY, migration_name text NOT NULL, checksum text NOT NULL, logs text,
    started_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at timestamptz, rolled_back_at timestamptz
  )`);
  const checksum = createHash("sha256").update(activitySql).digest("hex");
  await client.query(
    "INSERT INTO _prisma_migrations (id,migration_name,checksum,logs) VALUES ('failed',$1,$2,$3)",
    [
      inboxActivityMigration,
      checksum,
      "Database error: Conversation membership is immutable",
    ],
  );
  let resolved = 0;
  const options = {
    schema,
    log: () => {},
    resolve: async () => {
      resolved++;
    },
  };
  await client.query("UPDATE _prisma_migrations SET checksum='different'");
  await assert.rejects(
    recoverInboxActivity(client, options),
    /checksum differs/,
  );
  assert.equal(resolved, 0);
  await client.query(
    "UPDATE _prisma_migrations SET checksum=$1,logs='Other failure'",
    [checksum],
  );
  assert.equal(await recoverInboxActivity(client, options), false);
  await client.query(
    "UPDATE _prisma_migrations SET logs='Conversation membership is immutable'",
  );
  await client.query(
    "INSERT INTO _prisma_migrations (id,migration_name,checksum,logs) VALUES ('unrelated','other','x','other error')",
  );
  assert.equal(await recoverInboxActivity(client, options), false);
  await client.query("DELETE FROM _prisma_migrations WHERE id='unrelated'");
  await client.query(
    "ALTER TABLE conversations ADD COLUMN last_activity_at text",
  );
  await assert.rejects(
    recoverInboxActivity(client, options),
    /incompatible activity column/,
  );
  await client.query("ALTER TABLE conversations DROP COLUMN last_activity_at");
  await client.query(
    "CREATE INDEX conversations_participant_a_activity_idx ON conversations (participant_a_id)",
  );
  await assert.rejects(
    recoverInboxActivity(client, options),
    /incompatible activity index/,
  );
  await client.query("DROP INDEX conversations_participant_a_activity_idx");
  assert.equal(resolved, 0);
  // A crash after schema commit but before Prisma resolve must be safely retryable.
  await assert.rejects(
    recoverInboxActivity(client, {
      ...options,
      resolve: async () => {
        throw new Error("resolve interrupted");
      },
    }),
    /resolve interrupted/,
  );
  const newest = new Date("2026-12-01T00:00:00Z");
  await client.query("UPDATE conversations SET last_activity_at=$1", [newest]);
  assert.equal(
    await recoverInboxActivity(client, {
      ...options,
      resolve: async () => {
        resolved++;
        await client.query(
          "UPDATE _prisma_migrations SET finished_at=CURRENT_TIMESTAMP WHERE id='failed'",
        );
      },
    }),
    true,
  );
  assert.equal(resolved, 1);
  assert.equal(await recoverInboxActivity(client, options), false);
  const { rows } = await client.query(
    "SELECT last_activity_at FROM conversations",
  );
  assert.equal(+new Date(rows[0].last_activity_at), +newest);
  await assertConversationProtection(client);
}
