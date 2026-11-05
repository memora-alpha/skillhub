import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import pg from "pg";

test(
  "session-credit migration preserves historical NULLs and freezes new monetary snapshots",
  {
    skip:
      !process.env.TEST_DATABASE_URL &&
      "TEST_DATABASE_URL required for isolated schema",
  },
  async () => {
    const schema = `session_credit_test_${randomUUID().replaceAll("-", "")}`;
    const client = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      // Minimal predecessor table isolates the new migration and its legacy-row behavior.
      await client.query(`CREATE TABLE held_credit_allocations (
      allocation_id TEXT PRIMARY KEY, purpose TEXT, beneficiary_id TEXT,
      amount BIGINT, path_id TEXT, user_id TEXT, locked_path_version INTEGER,
      remaining_held BIGINT, status TEXT);
      INSERT INTO held_credit_allocations VALUES ('legacy','COMMITMENT',NULL,100,'path','a',1,100,'ACTIVE')`);
      await client.query(
        await readFile(
          new URL(
            "../../../prisma/migrations/20261106000000_session_credit/migration.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      assert.equal(
        (
          await client.query(
            "SELECT session_credit_snapshot FROM held_credit_allocations WHERE allocation_id='legacy'",
          )
        ).rows[0].session_credit_snapshot,
        null,
      );
      const snapshot = {
        policy: "TWO_WAY_SESSION_V1",
        feeBps: 400,
        totalUnits: "100",
        sessions: [{ id: "1" }, { id: "2" }],
      };
      await client.query(
        "INSERT INTO held_credit_allocations VALUES ('new','COMMITMENT',NULL,100,'path','b',1,100,'ACTIVE',$1)",
        [snapshot],
      );
      await assert.rejects(
        () =>
          client.query(
            "UPDATE held_credit_allocations SET amount=101 WHERE allocation_id='new'",
          ),
        /SESSION_CREDIT_SNAPSHOT_IMMUTABLE/,
      );
      await assert.rejects(
        () =>
          client.query(
            "UPDATE held_credit_allocations SET session_credit_snapshot=$1 WHERE allocation_id='legacy'",
            [snapshot],
          ),
        /SESSION_CREDIT_SNAPSHOT_IMMUTABLE/,
      );
      await assert.rejects(
        () =>
          client.query(
            "DELETE FROM held_credit_allocations WHERE allocation_id='new'",
          ),
        /SESSION_CREDIT_SNAPSHOT_IMMUTABLE/,
      );
      await assert.rejects(
        () =>
          client.query(
            "INSERT INTO held_credit_allocations VALUES ('bad','COMMITMENT',NULL,100,'path','c',1,100,'ACTIVE',$1)",
            [{ ...snapshot, totalUnits: "101" }],
          ),
        /session_credit_snapshot_shape/,
      );
      await client.query(
        "UPDATE held_credit_allocations SET remaining_held=0,status='RELEASED' WHERE allocation_id='new'",
      );
    } finally {
      await client.query("SET search_path TO public");
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  },
);
