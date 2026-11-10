import { test } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { verifyPathActivitySql } from "./path-activity-sql.fixture.mjs";

test(
  "PostgreSQL activity backfill, business triggers, no-op reads/retries, rollback and indexes",
  {
    skip:
      !process.env.TEST_DATABASE_URL &&
      "Set TEST_DATABASE_URL to isolated PostgreSQL",
  },
  async () => {
    const client = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
    const schema = `path_activity_${randomUUID().replaceAll("-", "")}`;
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await verifyPathActivitySql({
        query: (sql, params) => client.query(sql, params),
        exec: (sql) => client.query(sql),
      });
    } finally {
      await client.query("ROLLBACK");
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  },
);
