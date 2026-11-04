import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const inboxActivityMigration = "20261103000000_inbox_activity";
const migrations = new URL("../../prisma/migrations/", import.meta.url);
const guardMigration = "20261102235959_conversation_activity_guard";
const guardError = "Conversation membership is immutable";

function normalizedBody(sql) {
  const body = /AS \$\$([\s\S]*?)\$\$/.exec(sql)?.[1];
  if (!body) throw new Error("Inbox recovery guard definition is missing");
  return body.replace(/\s+/gu, " ").trim();
}

function checksumMatches(sql, checksum) {
  const unix = sql.replaceAll("\r\n", "\n");
  return [sql, unix, unix.replaceAll("\n", "\r\n")].some(
    (value) => createHash("sha256").update(value).digest("hex") === checksum,
  );
}

async function repairSchema(client, guardSql) {
  await client.query("LOCK TABLE conversations IN ACCESS EXCLUSIVE MODE");
  const { rows: guards } = await client.query(`
    SELECT p.prosrc, t.tgenabled, t.tgtype
    FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
    WHERE t.tgrelid='conversations'::regclass
      AND t.tgname='conversation_immutability'
      AND p.oid=to_regprocedure('skillhub_guard_conversation()')`);
  const legacy = await readFile(
    new URL("20261009010000_connections/migration.sql", migrations),
    "utf8",
  );
  const legacyGuard = legacy.slice(
    legacy.indexOf("CREATE FUNCTION skillhub_guard_conversation()"),
  );
  const guard = guards[0];
  if (
    guards.length !== 1 ||
    !["O", "A"].includes(guard.tgenabled) ||
    guard.tgtype !== 23 ||
    ![normalizedBody(legacyGuard), normalizedBody(guardSql)].includes(
      guard.prosrc.replace(/\s+/gu, " ").trim(),
    )
  )
    throw new Error("Inbox recovery requires the known conversation guard");

  await client.query(guardSql);
  await client.query(
    "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ(3)",
  );
  const { rows: columns } = await client.query(`
    SELECT format_type(atttypid, atttypmod) AS type
    FROM pg_attribute WHERE attrelid='conversations'::regclass
      AND attname='last_activity_at' AND NOT attisdropped`);
  if (columns[0]?.type !== "timestamp(3) with time zone")
    throw new Error("Inbox recovery found an incompatible activity column");
  await client.query(
    "UPDATE conversations SET last_activity_at=created_at WHERE last_activity_at IS NULL",
  );
  await client.query(
    "ALTER TABLE conversations ALTER COLUMN last_activity_at SET DEFAULT CURRENT_TIMESTAMP, ALTER COLUMN last_activity_at SET NOT NULL",
  );
  // Each index is created then validated on the same transaction/connection.
  for (const participant of ["a", "b"]) {
    const index = `conversations_participant_${participant}_activity_idx`;
    await client.query(`CREATE INDEX IF NOT EXISTS ${index} ON conversations
      (participant_${participant}_id, last_activity_at DESC, conversation_id DESC)`);
    const { rows } = await client.query(
      `
      SELECT i.indisvalid, i.indisunique, i.indnatts, i.indpred IS NULL AS unfiltered,
        am.amname, pg_get_indexdef(i.indexrelid,1,true) AS first,
        pg_get_indexdef(i.indexrelid,2,true) AS second,
        pg_get_indexdef(i.indexrelid,3,true) AS third
      FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
      JOIN pg_am am ON am.oid=c.relam
      WHERE i.indexrelid=to_regclass($1) AND i.indrelid='conversations'::regclass`,
      [index],
    );
    const row = rows[0];
    if (
      !row?.indisvalid ||
      row.indisunique ||
      row.indnatts !== 3 ||
      !row.unfiltered ||
      row.amname !== "btree" ||
      row.first !== `participant_${participant}_id` ||
      row.second !== "last_activity_at" ||
      row.third !== "conversation_id"
    )
      throw new Error("Inbox recovery found an incompatible activity index");
    // Column expressions above omit ordering; check PostgreSQL's per-key options too.
    const { rows: options } = await client.query(
      "SELECT indoption::text AS ordering FROM pg_index WHERE indexrelid=to_regclass($1)",
      [index],
    );
    if (options[0]?.ordering !== "0 3 3")
      throw new Error(
        "Inbox recovery found incompatible activity index ordering",
      );
  }
}

/** Called under the release advisory lock. Never resolves unrelated migration failures. */
export async function recoverInboxActivity(
  client,
  { schema = "public", resolve, log = console.log } = {},
) {
  let repaired = false;
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout='10s'");
    await client.query("SELECT set_config('search_path',$1,true)", [
      `"${schema.replaceAll('"', '""')}"`,
    ]);
    const { rows: tables } = await client.query(
      "SELECT to_regclass('_prisma_migrations') AS name",
    );
    if (tables[0]?.name) {
      const { rows } =
        await client.query(`SELECT migration_name, checksum, logs FROM _prisma_migrations
        WHERE finished_at IS NULL AND rolled_back_at IS NULL ORDER BY started_at`);
      const failed = rows[0];
      if (
        rows.length === 1 &&
        failed.migration_name === inboxActivityMigration &&
        failed.logs?.includes(guardError)
      ) {
        const sql = await readFile(
          new URL(`${inboxActivityMigration}/migration.sql`, migrations),
          "utf8",
        );
        if (!checksumMatches(sql, failed.checksum))
          throw new Error(
            "Inbox recovery migration checksum differs from the failed release",
          );
        await repairSchema(
          client,
          await readFile(
            new URL(`${guardMigration}/migration.sql`, migrations),
            "utf8",
          ),
        );
        repaired = true;
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  if (repaired) {
    // Schema completion commits first. If resolve fails, the next start safely retries.
    await resolve();
    log(
      "Recovered Inbox activity migration blocked by the legacy conversation guard",
    );
  }
  return repaired;
}
