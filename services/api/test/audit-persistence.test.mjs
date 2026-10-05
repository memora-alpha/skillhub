import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.TEST_DATABASE_URL;
const appDatabaseUrl = process.env.TEST_AUDIT_APP_DATABASE_URL;

function auditValues(id) {
  return [
    id,
    "SYSTEM",
    "foundation-test",
    "SYSTEM_CONFIGURATION_UPDATE",
    "SYSTEM_CONFIGURATION",
    "storage.downloadTtlSeconds",
    "test event",
    randomUUID(),
    randomUUID(),
  ];
}

const insertSql = `INSERT INTO audit_logs
  (id, actor_kind, system_actor, actor_roles, action, target_type, target_id, reason, request_id, correlation_id)
  VALUES ($1,$2,$3,'{}',$4,$5,$6,$7,$8,$9) RETURNING created_at`;

test(
  "audit rows have database UTC instants and reject UPDATE, DELETE and TRUNCATE",
  {
    skip:
      !databaseUrl &&
      "Set TEST_DATABASE_URL to a migrated isolated PostgreSQL database",
  },
  async () => {
    const client = new Client({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 3000,
    });
    await client.connect();
    const auditId = randomUUID();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(insertSql, auditValues(auditId));
      assert.equal(rows.length, 1);
      assert.ok(rows[0].created_at instanceof Date);
      assert.match(rows[0].created_at.toISOString(), /Z$/);
      for (const sql of [
        "UPDATE audit_logs SET reason = 'changed' WHERE id = $1",
        "DELETE FROM audit_logs WHERE id = $1",
        "TRUNCATE audit_logs",
      ]) {
        await client.query("SAVEPOINT mutation_attempt");
        await assert.rejects(
          client.query(sql, sql.includes("$1") ? [auditId] : []),
          /append-only/,
        );
        await client.query("ROLLBACK TO SAVEPOINT mutation_attempt");
      }
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  },
);

test(
  "failed audit insert rolls back its caller's configuration mutation",
  {
    skip:
      !databaseUrl &&
      "Set TEST_DATABASE_URL to a migrated isolated PostgreSQL database",
  },
  async () => {
    const client = new Client({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 3000,
    });
    await client.connect();
    const key = `audit_fixture.${randomUUID()}`;
    const auditId = randomUUID();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO system_configurations (key, value, version, updated_at) VALUES ($1, $2::jsonb, 1, CURRENT_TIMESTAMP)",
        [key, "120"],
      );
      await client.query(insertSql, auditValues(auditId));
      await assert.rejects(
        client.query(insertSql, auditValues(auditId)),
        /duplicate key/,
      );
      await client.query("ROLLBACK");
      const config = await client.query(
        "SELECT key FROM system_configurations WHERE key = $1",
        [key],
      );
      const audit = await client.query(
        "SELECT id FROM audit_logs WHERE id = $1",
        [auditId],
      );
      assert.equal(config.rowCount, 0);
      assert.equal(audit.rowCount, 0);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      await client.end();
    }
  },
);

test(
  "runtime application role has only SELECT and INSERT audit privileges",
  {
    skip:
      !appDatabaseUrl &&
      "Set TEST_AUDIT_APP_DATABASE_URL to a separate least-privilege test role",
  },
  async () => {
    const client = new Client({
      connectionString: appDatabaseUrl,
      connectionTimeoutMillis: 3000,
    });
    await client.connect();
    try {
      const { rows } = await client.query(`SELECT
      has_table_privilege(current_user, 'audit_logs', 'SELECT') AS can_select,
      has_table_privilege(current_user, 'audit_logs', 'INSERT') AS can_insert,
      has_table_privilege(current_user, 'audit_logs', 'UPDATE') AS can_update,
      has_table_privilege(current_user, 'audit_logs', 'DELETE') AS can_delete,
      has_table_privilege(current_user, 'audit_logs', 'TRUNCATE') AS can_truncate`);
      assert.deepEqual(rows[0], {
        can_select: true,
        can_insert: true,
        can_update: false,
        can_delete: false,
        can_truncate: false,
      });
    } finally {
      await client.end();
    }
  },
);
