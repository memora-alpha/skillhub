import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export const activityMigration = new URL(
  "../../prisma/migrations/20261111000000_learning_path_activity/migration.sql",
  import.meta.url,
);
const path = "10101010-0000-4000-8000-000000000001";
const other = "10101010-0000-4000-8000-000000000002";
const plan = "20202020-0000-4000-8000-000000000001";
const schedule = "30303030-0000-4000-8000-000000000001";

/** SQL projection contract on isolated tables; query/exec work with pg or embedded PostgreSQL. */
export async function verifyPathActivitySql(db) {
  await db.exec(`
    CREATE TABLE learning_paths (
      path_id UUID PRIMARY KEY, participant_a_id UUID, participant_b_id UUID,
      current_version INT DEFAULT 1, locked_version INT, status TEXT DEFAULT 'PROPOSED',
      created_at TIMESTAMPTZ(3), updated_at TIMESTAMPTZ(3), completed_at TIMESTAMPTZ(3),
      settled_at TIMESTAMPTZ(3), termination_approved_at TIMESTAMPTZ(3), settled_path_version INT,
      participant_a_settlement_approved_at TIMESTAMPTZ(3), participant_b_settlement_approved_at TIMESTAMPTZ(3),
      settlement_fee_snapshot JSONB
    );
    CREATE TABLE learning_path_versions (path_id UUID, version_no INT, created_at TIMESTAMPTZ(3),
      participant_a_confirmed_at TIMESTAMPTZ(3), participant_b_confirmed_at TIMESTAMPTZ(3), fee_amount_snapshot BIGINT);
    CREATE TABLE learning_plans (plan_id UUID PRIMARY KEY, path_id UUID, current_version INT, status TEXT, created_at TIMESTAMPTZ(3), updated_at TIMESTAMPTZ(3));
    CREATE TABLE learning_plan_versions (plan_id UUID, version_no INT, created_at TIMESTAMPTZ(3), learner_confirmed_at TIMESTAMPTZ(3));
    CREATE TABLE schedule_proposals (schedule_proposal_id UUID PRIMARY KEY, path_id UUID, current_version INT, applied_version INT, status TEXT);
    CREATE TABLE schedule_versions (schedule_proposal_id UUID, version_no INT, path_id UUID, path_version INT, created_at TIMESTAMPTZ(3),
      participant_a_confirmed_at TIMESTAMPTZ(3), participant_b_confirmed_at TIMESTAMPTZ(3));
    CREATE TABLE sessions (session_id UUID, path_id UUID);
    CREATE TABLE session_schedule_history (session_id UUID, applied_at TIMESTAMPTZ(3));
    INSERT INTO learning_paths(path_id,created_at,updated_at) VALUES ('${path}','2026-11-01','2099-01-01'), ('${other}','2026-11-08','2099-01-01');
    INSERT INTO learning_path_versions VALUES ('${path}',1,'2026-11-01','2026-11-02',NULL,NULL);
    INSERT INTO learning_plans VALUES ('${plan}','${path}',1,'CONFIRMED','2026-11-02','2099-01-01');
    INSERT INTO learning_plan_versions VALUES ('${plan}',1,'2026-11-03','2026-11-04');
    INSERT INTO schedule_proposals VALUES ('${schedule}','${path}',1,NULL,'PROPOSED');
    INSERT INTO schedule_versions VALUES ('${schedule}',1,'${path}',1,'2026-11-05','2026-11-06',NULL);
    INSERT INTO sessions VALUES ('40404040-0000-4000-8000-000000000001','${path}');
    INSERT INTO session_schedule_history VALUES ('40404040-0000-4000-8000-000000000001','2026-11-07');
  `);
  await db.exec(await readFile(activityMigration, "utf8"));
  const at = async () =>
    (
      await db.query(
        "SELECT last_activity_at FROM learning_paths WHERE path_id=$1",
        [path],
      )
    ).rows[0].last_activity_at.toISOString();
  assert.equal(
    await at(),
    "2026-11-07T00:00:00.000Z",
    "backfill uses business facts, not updated_at/migration time",
  );
  assert.equal(
    (
      await db.query(
        "SELECT last_activity_at FROM learning_paths WHERE path_id=$1",
        [other],
      )
    ).rows[0].last_activity_at.toISOString(),
    "2026-11-08T00:00:00.000Z",
  );
  const base = "2026-01-01T00:00:00.000Z";
  const expectActivity = async (sql) => {
    await db.query(
      "UPDATE learning_paths SET last_activity_at=$1 WHERE path_id=$2",
      [base, path],
    );
    await db.exec(sql);
    assert.ok((await at()) > base, sql);
  };
  const expectNoActivity = async (sql) => {
    const before = await at();
    await db.exec(sql);
    assert.equal(await at(), before, sql);
  };
  await expectNoActivity(
    `SELECT * FROM learning_paths; SELECT * FROM schedule_versions; UPDATE learning_paths SET updated_at=clock_timestamp(),status=status; UPDATE learning_path_versions SET fee_amount_snapshot=42; UPDATE learning_plans SET updated_at=clock_timestamp(); UPDATE schedule_proposals SET status=status; UPDATE schedule_versions SET participant_a_confirmed_at=participant_a_confirmed_at;`,
  );
  await expectActivity(
    `UPDATE schedule_versions SET participant_b_confirmed_at=clock_timestamp() WHERE version_no=1;`,
  );
  await expectNoActivity(
    `UPDATE schedule_versions SET participant_b_confirmed_at=participant_b_confirmed_at;`,
  );
  await expectActivity(
    `UPDATE learning_path_versions SET participant_b_confirmed_at=clock_timestamp() WHERE version_no=1;`,
  );
  await expectActivity(
    `UPDATE learning_paths SET current_version=2 WHERE path_id='${path}';`,
  );
  await expectActivity(
    `INSERT INTO learning_path_versions VALUES ('${path}',2,clock_timestamp(),NULL,NULL,NULL);`,
  );
  await expectNoActivity(
    `UPDATE learning_path_versions SET participant_a_confirmed_at=clock_timestamp() WHERE version_no=1;`,
  );
  await expectActivity(
    `UPDATE learning_plan_versions SET learner_confirmed_at=clock_timestamp() WHERE version_no=1;`,
  );
  await expectActivity(
    `UPDATE learning_plans SET current_version=2; INSERT INTO learning_plan_versions VALUES ('${plan}',2,clock_timestamp(),NULL);`,
  );
  await expectActivity(
    `INSERT INTO learning_plans VALUES ('20202020-0000-4000-8000-000000000002','${path}',1,'PROPOSED',clock_timestamp(),clock_timestamp());`,
  );
  await expectNoActivity(
    `UPDATE learning_plan_versions SET learner_confirmed_at=clock_timestamp() WHERE version_no=1;`,
  );
  await expectActivity(
    `INSERT INTO schedule_versions VALUES ('${schedule}',2,'${path}',2,clock_timestamp(),NULL,NULL); UPDATE schedule_proposals SET current_version=2,status='NEEDS_REVISION';`,
  );
  await expectActivity(
    `INSERT INTO schedule_proposals VALUES ('30303030-0000-4000-8000-000000000002','${path}',1,NULL,'PROPOSED');`,
  );
  await expectActivity(
    `UPDATE schedule_versions SET participant_a_confirmed_at=clock_timestamp() WHERE version_no=2;`,
  );
  await expectNoActivity(
    `UPDATE schedule_versions SET participant_a_confirmed_at=clock_timestamp() WHERE version_no=1;`,
  );
  await expectActivity(
    `UPDATE learning_paths SET status='SCHEDULED',locked_version=1 WHERE path_id='${path}';`,
  );
  await expectNoActivity(
    `UPDATE learning_paths SET status='SCHEDULED',locked_version=1 WHERE path_id='${path}';`,
  );
  await expectActivity(
    `UPDATE learning_paths SET status='ACTIVE' WHERE path_id='${path}';`,
  );
  await expectActivity(
    `UPDATE learning_paths SET participant_a_settlement_approved_at=clock_timestamp() WHERE path_id='${path}';`,
  );
  await expectActivity(
    `UPDATE learning_paths SET settled_at=clock_timestamp(),settled_path_version=1 WHERE path_id='${path}';`,
  );
  // A failed source transaction rolls its derived activity back too.
  const beforeRollback = await at();
  await db.exec(
    `BEGIN; UPDATE learning_paths SET status='COMPLETED' WHERE path_id='${path}'; ROLLBACK;`,
  );
  assert.equal(await at(), beforeRollback);
  await db.query(
    "UPDATE learning_paths SET last_activity_at='2099-01-01' WHERE path_id=$1",
    [path],
  );
  await expectNoActivity(
    `UPDATE learning_paths SET status='COMPLETED' WHERE path_id='${path}';`,
  );
  const indexes = await db.query(
    "SELECT indexname,indexdef FROM pg_indexes WHERE schemaname=current_schema() AND tablename='learning_paths' AND indexname LIKE '%activity_idx'",
  );
  assert.equal(indexes.rows.length, 2);
  assert.ok(
    indexes.rows.every((i) =>
      i.indexdef.includes("last_activity_at DESC, path_id DESC"),
    ),
  );
}
