import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

test(
  "ordering migration preserves old conversations and installs pagination indexes",
  {
    skip:
      !process.env.TEST_DATABASE_URL &&
      "Set TEST_DATABASE_URL to an isolated PostgreSQL test database",
  },
  async () => {
    const client = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    const schema = `ordering_test_${randomUUID().replaceAll("-", "")}`;
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(`CREATE TABLE conversations (
      conversation_id uuid PRIMARY KEY, participant_a_id uuid, participant_b_id uuid,
      created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    ); CREATE TABLE sharing_skills (sharing_skill_id uuid PRIMARY KEY, user_id uuid, created_at timestamptz(3));`);
      await client.query(
        "INSERT INTO conversations(conversation_id, created_at) VALUES ($1, $2)",
        [randomUUID(), "2026-10-01T00:00:00.000Z"],
      );
      await client.query(
        await readFile(
          new URL(
            "../../prisma/migrations/20261030000000_mobile_list_ordering/migration.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const { rows } = await client.query(
        "SELECT created_at, last_activity_at FROM conversations",
      );
      assert.equal(
        rows[0].last_activity_at.getTime(),
        rows[0].created_at.getTime(),
      );
      const indexes = await client.query(
        "SELECT indexname FROM pg_indexes WHERE schemaname = $1",
        [schema],
      );
      for (const name of [
        "conversations_participant_a_activity_idx",
        "conversations_participant_b_activity_idx",
        "sharing_skills_user_created_idx",
      ])
        assert(indexes.rows.some((row) => row.indexname === name));
    } finally {
      await client.query("SET search_path TO public");
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  },
);
