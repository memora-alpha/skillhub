import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

const url = process.env.TEST_DATABASE_URL;
test(
  "schedule migration retains legacy timestamps, clears empty arrays and does not invoke lifecycle updates",
  {
    skip: !url && "Set TEST_DATABASE_URL to an isolated PostgreSQL server",
    timeout: 30000,
  },
  async () => {
    const schema = `proposal_schedule_${randomUUID().replaceAll("-", "")}`;
    const client = new pg.Client({
      connectionString: url,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(`
      CREATE TABLE proposals (id integer PRIMARY KEY, candidate_slots jsonb NOT NULL DEFAULT '[]');
      CREATE FUNCTION deny_lifecycle_update() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Proposal lifecycle must remain untouched'; END $$;
      CREATE TRIGGER proposal_immutability BEFORE UPDATE ON proposals
        FOR EACH ROW EXECUTE FUNCTION deny_lifecycle_update();
    `);
      const slots = [
        { startAt: "2026-01-01T02:00:00Z", endAt: "2026-01-01T03:00:00Z" },
      ];
      for (const [id, value] of [
        [1, []],
        [2, slots],
        [3, null],
        [4, "Cuối tuần"],
      ])
        await client.query("INSERT INTO proposals VALUES ($1, $2::jsonb)", [
          id,
          JSON.stringify(value),
        ]);
      await client.query(
        await readFile(
          new URL(
            "../../prisma/migrations/20261019000000_proposal_schedule_text/migration.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const { rows } = await client.query(
        "SELECT * FROM proposals ORDER BY id",
      );
      assert.equal(rows[0].candidate_slots, null);
      assert.deepEqual(JSON.parse(rows[1].candidate_slots), slots);
      assert.equal(rows[2].candidate_slots, null);
      assert.equal(rows[3].candidate_slots, "Cuối tuần");
      await client.query(
        "INSERT INTO proposals (id, candidate_slots) VALUES (5, $1), (6, NULL)",
        ["Tối Thứ 5 và Thứ 7"],
      );
      await client.query("INSERT INTO proposals (id) VALUES (7)");
      assert.equal(
        (await client.query("SELECT candidate_slots FROM proposals WHERE id=7"))
          .rows[0].candidate_slots,
        null,
      );
      const column = (
        await client.query(
          "SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name='proposals' AND column_name='candidate_slots'",
          [schema],
        )
      ).rows[0];
      assert.deepEqual(column, {
        data_type: "text",
        is_nullable: "YES",
        column_default: null,
      });
    } finally {
      await client.query("ROLLBACK");
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  },
);
