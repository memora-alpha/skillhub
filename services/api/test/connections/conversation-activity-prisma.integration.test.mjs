import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import pg from "pg";
import { prepareLegacyConversation } from "./conversation-activity.fixture.mjs";
import {
  recoverInboxActivity,
  inboxActivityMigration,
} from "../../scripts/lib/recover-inbox-activity.mjs";

const require = createRequire(import.meta.url);

test(
  "Prisma deploy reproduces P3018, recovery resolves it and deploy records the guard dependency",
  {
    skip:
      !process.env.TEST_DATABASE_URL &&
      "Set TEST_DATABASE_URL to isolated PostgreSQL",
    timeout: 120000,
  },
  async () => {
    const schema = `activity_cli_${randomUUID().replaceAll("-", "")}`;
    const url = new URL(process.env.TEST_DATABASE_URL);
    url.searchParams.set("schema", schema);
    const directory = await mkdtemp(join(tmpdir(), "inbox-prisma-test-"));
    const config = join(directory, "prisma.config.mjs");
    const migrationRoot = join(directory, "migrations");
    const client = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
    async function prisma(args) {
      const child = spawn(
        process.execPath,
        [require.resolve("prisma/build/index.js"), ...args, "--config", config],
        {
          env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";
      child.stdout.on("data", (data) => {
        output += data;
      });
      child.stderr.on("data", (data) => {
        output += data;
      });
      const code = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", resolve);
      });
      return { code, output };
    }
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await prepareLegacyConversation(client);
      const schemaPath = join(directory, "schema.prisma");
      await writeFile(
        schemaPath,
        'datasource db {\n  provider = "postgresql"\n}\n',
      );
      await writeFile(
        config,
        `export default ${JSON.stringify({ schema: schemaPath, migrations: { path: migrationRoot }, datasource: { url: url.toString() } })};\n`,
      );
      const baseline = "20261009010000_connections";
      await mkdir(join(migrationRoot, baseline), { recursive: true });
      await writeFile(
        join(migrationRoot, "migration_lock.toml"),
        'provider = "postgresql"\n',
      );
      await writeFile(
        join(migrationRoot, baseline, "migration.sql"),
        "SELECT 1;\n",
      );
      await mkdir(join(migrationRoot, inboxActivityMigration));
      const actualMigrations = new URL(
        "../../prisma/migrations/",
        import.meta.url,
      );
      await writeFile(
        join(migrationRoot, inboxActivityMigration, "migration.sql"),
        await readFile(
          new URL(`${inboxActivityMigration}/migration.sql`, actualMigrations),
        ),
      );
      assert.equal(
        (await prisma(["migrate", "resolve", "--applied", baseline])).code,
        0,
      );
      const failed = await prisma(["migrate", "deploy"]);
      assert.notEqual(failed.code, 0);
      assert.match(failed.output, /P3018/);
      assert.match(failed.output, /Conversation membership is immutable/);
      const blocked = await prisma(["migrate", "deploy"]);
      assert.match(blocked.output, /P3009/);
      assert.equal(
        await recoverInboxActivity(client, {
          schema,
          log: () => {},
          resolve: async () => {
            const result = await prisma([
              "migrate",
              "resolve",
              "--applied",
              inboxActivityMigration,
            ]);
            assert.equal(result.code, 0, result.output);
          },
        }),
        true,
      );
      const guard = "20261102235959_conversation_activity_guard";
      await mkdir(join(migrationRoot, guard));
      await writeFile(
        join(migrationRoot, guard, "migration.sql"),
        await readFile(new URL(`${guard}/migration.sql`, actualMigrations)),
      );
      const deployed = await prisma(["migrate", "deploy"]);
      assert.equal(deployed.code, 0, deployed.output);
      const { rows } = await client.query(
        "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name",
      );
      assert.deepEqual(
        rows.map((row) => row.migration_name),
        [baseline, guard, inboxActivityMigration],
      );
      assert.equal(
        await recoverInboxActivity(client, {
          schema,
          resolve: async () => assert.fail("already applied"),
        }),
        false,
      );
      await client.query(
        "UPDATE conversations SET last_activity_at=CURRENT_TIMESTAMP",
      );
    } finally {
      await client.query("SET search_path TO public");
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
