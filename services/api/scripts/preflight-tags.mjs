import "dotenv/config";
import pg from "pg";
import { normalizeTagLabel } from "../dist/modules/skills/domain/tag-policy.js";

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--verify"))
  throw new Error("Usage: node scripts/preflight-tags.mjs [--verify]");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const verify = args.includes("--verify");
const whitespace =
  "[\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+";
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
try {
  await client.connect();
  await client.query("SET statement_timeout = '30s'");
  const { rows } = await client.query(
    `SELECT tag_id AS id,label,
    lower(btrim(regexp_replace(normalize(label,NFC),$1,' ','g'))) AS "sqlKey"
    ${verify ? ',label_key AS "storedKey"' : ""} FROM tags ORDER BY tag_id`,
    [whitespace],
  );
  const owners = new Map(),
    issues = [];
  for (const row of rows) {
    let key;
    try {
      key = normalizeTagLabel(row.label).labelKey;
    } catch {
      issues.push({ id: row.id, issue: "INVALID_LEGACY_TAG_LABEL" });
      continue;
    }
    if (owners.has(key))
      issues.push({
        id: row.id,
        otherId: owners.get(key),
        issue: "TAG_LABEL_COLLISION",
      });
    else owners.set(key, row.id);
    // Existing keys written by Node need not follow the database's locale casing.
    if ((!verify && row.sqlKey !== key) || (verify && row.storedKey !== key)) {
      issues.push({
        id: row.id,
        issue: verify ? "TAG_KEY_MISMATCH" : "TAG_SQL_NORMALIZATION_MISMATCH",
      });
    }
  }
  if (issues.length) {
    console.error(
      JSON.stringify(
        { status: "blocked", mode: verify ? "verify" : "preflight", issues },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } else
    console.log(
      JSON.stringify({
        status: "pass",
        mode: verify ? "verify" : "preflight",
        tags: rows.length,
      }),
    );
} finally {
  await client.end();
}
