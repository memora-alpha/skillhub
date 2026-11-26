import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { createSkillFixture } from "../../skills/helpers.mjs";

const url = process.env.TEST_DATABASE_URL;
const skip = !url && "TEST_DATABASE_URL required for isolated schema";
const migration = new URL(
  "../../../prisma/migrations/20261126000000_session_recording/migration.sql",
  import.meta.url,
);

/** Spec 020 T019: the migration alone, on stub parents, in a throwaway schema. */
async function isolatedSchema() {
  const schema = `recording_test_${randomUUID().replaceAll("-", "")}`;
  const connect = async () => {
    const client = new pg.Client({
      connectionString: url,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    await client.query(`SET search_path TO "${schema}"`);
    return client;
  };
  const admin = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 5000,
  });
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const db = await connect();
  await db.query(`
    CREATE TABLE sessions(session_id uuid PRIMARY KEY);
    CREATE TABLE users(user_id uuid PRIMARY KEY);
  `);
  await db.query(await readFile(migration, "utf8"));
  const dispose = async (...others) => {
    await Promise.all([db, ...others].map((client) => client.end()));
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  };
  return { db, connect, dispose };
}

async function parties(db) {
  const [sessionId, teacher, learner] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  await db.query("INSERT INTO sessions VALUES ($1)", [sessionId]);
  await db.query("INSERT INTO users VALUES ($1), ($2)", [teacher, learner]);
  return { sessionId, teacher, learner };
}

/** Inserts one row; `fields` override the REQUESTED defaults. */
function insert(db, base, fields = {}) {
  const row = {
    id: randomUUID(),
    session_id: base.sessionId,
    requested_by_user_id: base.learner,
    status: "REQUESTED",
    kind: "ROOM_COMPOSITE_VIDEO",
    requested_at: new Date(),
    updated_at: new Date(),
    ...fields,
  };
  const columns = Object.keys(row);
  const values = columns.map((_, index) => `$${index + 1}`);
  return db.query(
    `INSERT INTO session_recordings (${columns.map((c) => `"${c}"`).join(",")})
     VALUES (${values.join(",")}) RETURNING id`,
    Object.values(row),
  );
}

const violates = (promise, code, constraint) =>
  assert.rejects(promise, (error) => {
    assert.equal(error.code, code, error.message);
    if (constraint) assert.equal(error.constraint, constraint);
    return true;
  });

test("one active request or recording per Session", { skip }, async () => {
  const { db, dispose } = await isolatedSchema();
  try {
    const base = await parties(db);
    const first = (await insert(db, base)).rows[0].id;
    await violates(
      insert(db, base, { requested_by_user_id: base.teacher }),
      "23505",
      "session_recordings_one_active_per_session",
    );
    // Each active status takes the slot.
    for (const status of ["STARTING", "RECORDING", "STOPPING"]) {
      await db.query(
        "UPDATE session_recordings SET status=$2, accepted_by_user_id=$3 WHERE id=$1",
        [first, status, base.teacher],
      );
      await violates(
        insert(db, base),
        "23505",
        "session_recordings_one_active_per_session",
      );
    }
    await db.query(
      "UPDATE session_recordings SET status='FAILED', failure_code='EGRESS_FAILED' WHERE id=$1",
      [first],
    );
    await insert(db, base);
    // Another Session is independent.
    await insert(db, await parties(db));
  } finally {
    await dispose();
  }
});

test(
  "concurrent requests for one Session: the second waits, then fails",
  { skip },
  async () => {
    const { db, connect, dispose } = await isolatedSchema();
    const other = await connect();
    try {
      const base = await parties(db);
      await db.query("BEGIN");
      await other.query("BEGIN");
      await insert(db, base);
      const racing = insert(other, base, {
        requested_by_user_id: base.teacher,
      });
      // Give the second insert time to block on the first transaction's index entry.
      await new Promise((resolve) => setTimeout(resolve, 200));
      await db.query("COMMIT");
      await violates(
        racing,
        "23505",
        "session_recordings_one_active_per_session",
      );
      await other.query("ROLLBACK");
      const { rows } = await db.query(
        "SELECT count(*)::int AS n FROM session_recordings WHERE session_id=$1",
        [base.sessionId],
      );
      assert.equal(rows[0].n, 1);
    } finally {
      await dispose(other);
    }
  },
);

test(
  "CHECK constraints guard consent, files and removal",
  { skip },
  async () => {
    const { db, dispose } = await isolatedSchema();
    try {
      const base = await parties(db);
      const accepted = { accepted_by_user_id: base.teacher };
      await violates(
        insert(db, base, { accepted_by_user_id: base.learner }),
        "23514",
        "session_recordings_accepted_by_check",
      );
      await violates(
        insert(db, base, { status: "STARTING" }),
        "23514",
        "session_recordings_accepted_check",
      );
      await violates(
        insert(db, base, { ...accepted, status: "READY" }),
        "23514",
        "session_recordings_ready_file_check",
      );
      await violates(
        insert(db, base, { ...accepted, status: "EXPIRED" }),
        "23514",
        "session_recordings_removed_check",
      );
      await violates(
        insert(db, base, {
          ...accepted,
          status: "DELETED",
          deleted_at: new Date(),
        }),
        "23514",
        "session_recordings_deleted_by_check",
      );
      await violates(
        insert(db, base, { deleted_by_user_id: base.learner }),
        "23514",
        "session_recordings_deleted_by_check",
      );
      await violates(
        insert(db, base, { ...accepted, status: "FAILED", bytes: -1 }),
        "23514",
        "session_recordings_size_check",
      );
      await violates(
        insert(db, base, {
          ...accepted,
          status: "FAILED",
          started_at: new Date("2026-11-02T10:00:00Z"),
          ended_at: new Date("2026-11-02T09:59:59Z"),
        }),
        "23514",
        "session_recordings_ended_after_start_check",
      );
      // Valid terminal rows: a READY file, a DELETED row with its key cleared, an EXPIRED row.
      await insert(db, base, {
        ...accepted,
        status: "READY",
        object_key: "recordings/s/r.mp4",
        egress_id: "EG_1",
      });
      await insert(db, base, {
        ...accepted,
        status: "DELETED",
        deleted_at: new Date(),
        deleted_by_user_id: base.learner,
      });
      await insert(db, base, {
        ...accepted,
        status: "EXPIRED",
        deleted_at: new Date(),
      });
      await violates(
        insert(db, base, { ...accepted, status: "FAILED", egress_id: "EG_1" }),
        "23505",
        "session_recordings_egress_id_key",
      );
      await violates(
        insert(db, { ...base, sessionId: randomUUID() }),
        "23503",
        "session_recordings_session_id_fkey",
      );
    } finally {
      await dispose();
    }
  },
);

test(
  "the full migration chain creates the recording table",
  { skip },
  async () => {
    const fixture = await createSkillFixture();
    try {
      const table = await fixture.client.query(
        `SELECT count(*)::int AS n FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = 'session_recordings'`,
        [fixture.schema],
      );
      assert.equal(table.rows[0].n, 1);
      const index = await fixture.client.query(
        `SELECT indexdef FROM pg_indexes
       WHERE schemaname = $1 AND indexname = 'session_recordings_one_active_per_session'`,
        [fixture.schema],
      );
      assert.match(index.rows[0].indexdef, /WHERE/);
      // The generated client sees the table through Prisma too.
      assert.equal(await fixture.db.sessionRecording.count(), 0);
    } finally {
      await fixture.dispose();
    }
  },
);
