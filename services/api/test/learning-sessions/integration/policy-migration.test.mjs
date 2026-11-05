import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

test(
  "policy migration preserves original history, excludes makeup and no-op revisions, and retains legacy excess",
  {
    skip:
      !process.env.TEST_DATABASE_URL &&
      "TEST_DATABASE_URL required for isolated schema",
  },
  async () => {
    const client = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
    const schema = `session_policy_test_${randomUUID().replaceAll("-", "")}`;
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(`
      CREATE TABLE sessions(session_id integer PRIMARY KEY, start_at timestamptz, status text);
      CREATE TABLE learning_paths(path_id integer PRIMARY KEY);
      CREATE TABLE schedule_items(schedule_item_id integer PRIMARY KEY, start_at timestamptz, end_at timestamptz);
      CREATE TABLE session_schedule_history(history_id integer PRIMARY KEY, session_id integer, schedule_item_id integer, applied_at timestamptz);
      CREATE TABLE learning_change_requests(session_id integer, occurrence_start_at timestamptz, kind text, status text);
      CREATE TABLE session_attendance_outcomes(session_id integer, occurrence_start_at timestamptz, resolution text, evidence jsonb DEFAULT '{}');
      CREATE TABLE report_cases(related_session_id integer, reason_code text, status text);
      INSERT INTO sessions VALUES (1,'2026-11-04 10:00Z','CONFIRMED'), (2,'2026-11-07 10:00Z','CONFIRMED'), (3,'2026-11-02 10:00Z','MAKEUP_REQUIRED');
      INSERT INTO schedule_items VALUES
        (1,'2026-11-02 10:00Z','2026-11-02 11:00Z'),
        (2,'2026-11-02 10:00Z','2026-11-02 11:00Z'),
        (3,'2026-11-03 10:00Z','2026-11-03 11:00Z'),
        (4,'2026-11-04 10:00Z','2026-11-04 11:00Z');
      INSERT INTO session_schedule_history SELECT n,1,n,'2026-10-20 00:00Z'::timestamptz+n*interval '1 minute' FROM generate_series(1,4) n;
      INSERT INTO learning_change_requests VALUES (1,'2026-11-03 10:00Z','SESSION_CANCELLATION','APPLIED');
      INSERT INTO session_attendance_outcomes(session_id,occurrence_start_at,resolution) VALUES (1,'2026-11-03 10:00Z','MAKEUP_REQUIRED');
      INSERT INTO sessions VALUES (5,'2026-11-02 10:00Z','DISPUTED');
      INSERT INTO session_attendance_outcomes(session_id,occurrence_start_at,resolution) VALUES (5,'2026-11-02 10:00Z','STAFF_REVIEW');
      INSERT INTO report_cases VALUES (5,'MAKEUP_EXPIRED','OPEN');
      INSERT INTO schedule_items SELECT 10+n,'2026-11-02 10:00Z'::timestamptz+n*interval '1 day','2026-11-02 11:00Z'::timestamptz+n*interval '1 day' FROM generate_series(0,5) n;
      INSERT INTO session_schedule_history SELECT 10+n,2,10+n,'2026-10-20 00:00Z'::timestamptz+n*interval '1 minute' FROM generate_series(0,5) n;
    `);
      await client.query(
        await readFile(
          new URL(
            "../../../prisma/migrations/20261105010000_session_policy_settlement/migration.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const { rows } = await client.query(
        "SELECT * FROM sessions ORDER BY session_id",
      );
      assert.equal(
        rows[0].original_start_at.toISOString(),
        "2026-11-02T10:00:00.000Z",
      );
      assert.equal(rows[0].reschedule_count, 1);
      assert.equal(rows[0].makeup_count, 1);
      assert.equal(rows[1].reschedule_count, 5);
      assert.equal(rows[2].makeup_count, 1);
      assert.equal(rows[3].makeup_count, 1);
      assert.equal(
        (
          await client.query(
            "SELECT evidence->>'makeupGranted' AS granted FROM session_attendance_outcomes WHERE session_id=5",
          )
        ).rows[0].granted,
        "true",
      );
      await assert.rejects(
        () =>
          client.query(
            "UPDATE sessions SET original_start_at=start_at+interval '1 day' WHERE session_id=1",
          ),
        /SESSION_POLICY_HISTORY_IMMUTABLE/,
      );
      await assert.rejects(
        () =>
          client.query(
            "UPDATE sessions SET reschedule_count=0 WHERE session_id=1",
          ),
        /SESSION_POLICY_HISTORY_IMMUTABLE/,
      );
      await client.query(
        "INSERT INTO sessions(session_id,start_at,status) VALUES (4,'2026-11-10 10:00Z','CONFIRMED')",
      );
      assert.equal(
        (
          await client.query(
            "SELECT original_start_at=start_at AS preserved FROM sessions WHERE session_id=4",
          )
        ).rows[0].preserved,
        true,
      );
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  },
);
