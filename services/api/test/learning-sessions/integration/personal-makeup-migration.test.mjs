import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

test(
  "personal makeup migration attributes requesters and absent users without guessing unknown legacy responsibility",
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
    const schema = `personal_makeup_test_${randomUUID().replaceAll("-", "")}`;
    const teacher = randomUUID(),
      learner = randomUUID(),
      outsider = randomUUID();
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(`
      CREATE TABLE sessions(session_id integer PRIMARY KEY, teacher_id uuid, learner_id uuid, start_at timestamptz DEFAULT '2026-11-02 10:00Z', original_start_at timestamptz DEFAULT '2026-11-02 10:00Z', reschedule_count integer DEFAULT 0, makeup_count integer DEFAULT 0);
      CREATE TABLE learning_change_requests(session_id integer, requester_id uuid, kind text, status text);
      CREATE TABLE session_attendance_outcomes(session_id integer, resolution text, evidence jsonb, teacher_verdict text, learner_verdict text);
      CREATE FUNCTION guard_session_policy_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
      CREATE TRIGGER session_policy_history_guard BEFORE INSERT OR UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION guard_session_policy_history();
    `);
      for (let n = 1; n <= 5; n++)
        await client.query(
          "INSERT INTO sessions(session_id,teacher_id,learner_id,makeup_count) VALUES ($1,$2,$3,1)",
          [n, teacher, learner],
        );
      await client.query(
        "INSERT INTO learning_change_requests VALUES (1,$1,'SESSION_CANCELLATION','APPLIED'),(2,$2,'SESSION_CANCELLATION','REJECTED')",
        [learner, teacher],
      );
      await client.query(`INSERT INTO session_attendance_outcomes VALUES
      (2,'MAKEUP_REQUIRED','{}','ABSENT','PRESENT'),
      (3,'STAFF_REVIEW','{"makeupGranted":true}','ABSENT','ABSENT'),
      (4,'MAKEUP_REQUIRED','{}','UNVERIFIABLE','UNVERIFIABLE')`);
      await client.query(
        await readFile(
          new URL(
            "../../../prisma/migrations/20261105020000_personal_makeup_quota/migration.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const { rows } = await client.query(
        "SELECT * FROM sessions ORDER BY session_id",
      );
      assert.deepEqual(rows[0].makeup_user_ids, [learner]);
      assert.deepEqual(rows[1].makeup_user_ids, [teacher]);
      assert.deepEqual(
        [...rows[2].makeup_user_ids].sort((left, right) =>
          left.localeCompare(right),
        ),
        [teacher, learner].sort((left, right) => left.localeCompare(right)),
      );
      assert.deepEqual(rows[3].makeup_user_ids, []);
      assert.deepEqual(rows[4].makeup_user_ids, []);
      await assert.rejects(
        () =>
          client.query(
            "UPDATE sessions SET makeup_user_ids=ARRAY[$1::uuid] WHERE session_id=1",
            [teacher],
          ),
        /SESSION_POLICY_HISTORY_IMMUTABLE/,
      );
      await assert.rejects(
        () =>
          client.query(
            "UPDATE sessions SET makeup_user_ids=ARRAY[$1::uuid] WHERE session_id=4",
            [outsider],
          ),
        /session_makeup_users_check/,
      );
      await assert.rejects(
        () =>
          client.query(
            "UPDATE sessions SET makeup_user_ids=ARRAY[$1::uuid,$1::uuid] WHERE session_id=4",
            [teacher],
          ),
        /session_makeup_users_check/,
      );
      await client.query(
        "INSERT INTO sessions(session_id,teacher_id,learner_id) VALUES (6,$1,$2)",
        [teacher, learner],
      );
      assert.deepEqual(
        (
          await client.query(
            "SELECT makeup_user_ids FROM sessions WHERE session_id=6",
          )
        ).rows[0].makeup_user_ids,
        [],
      );
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  },
);
