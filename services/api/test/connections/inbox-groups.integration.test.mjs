import { test } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  checkInboxActivityMigration,
  checkInboxGroupQueries,
} from "./inbox-groups.fixture.mjs";

test(
  "PostgreSQL grouped Inbox counts complete history, isolates membership and paginates groups",
  {
    skip:
      !process.env.TEST_DATABASE_URL &&
      "Set TEST_DATABASE_URL to isolated PostgreSQL",
    timeout: 60000,
  },
  async () => {
    const schema = `inbox_test_${randomUUID().replaceAll("-", "")}`;
    const client = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await checkInboxActivityMigration(client);
      await checkInboxGroupQueries(client);
    } finally {
      await client.query("SET search_path TO public");
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  },
);
