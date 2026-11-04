import { test } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  checkConversationActivityGuard,
  checkConversationActivityRecovery,
} from "./conversation-activity.fixture.mjs";

for (const [name, check] of [
  [
    "populated legacy chats migrate and keep membership immutable",
    checkConversationActivityGuard,
  ],
  [
    "known Inbox failure recovers transactionally and retries Prisma resolution",
    checkConversationActivityRecovery,
  ],
]) {
  test(
    name,
    {
      skip:
        !process.env.TEST_DATABASE_URL &&
        "Set TEST_DATABASE_URL to isolated PostgreSQL",
      timeout: 60000,
    },
    async () => {
      const schema = `activity_test_${randomUUID().replaceAll("-", "")}`;
      const client = new pg.Client({
        connectionString: process.env.TEST_DATABASE_URL,
        connectionTimeoutMillis: 5000,
      });
      await client.connect();
      try {
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET search_path TO "${schema}"`);
        await check(client, schema);
      } finally {
        await client.query("SET search_path TO public");
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await client.end();
      }
    },
  );
}
