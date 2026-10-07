import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const apiRoot = fileURLToPath(new URL("../..", import.meta.url));
const migrationPath = `${apiRoot}/prisma/migrations/20261006000000_learning_requests/migration.sql`;

test("scoped migration creates request storage and database safety constraints", () => {
  assert.ok(existsSync(migrationPath), "missing Learning Request migration");
  const sql = readFileSync(migrationPath, "utf8");
  for (const name of [
    "learning_requests",
    "learning_request_tags",
    "notifications",
  ]) {
    assert.ok(sql.includes(`CREATE TABLE "${name}"`), `missing table ${name}`);
  }
  for (const constraint of [
    "learning_requests_title_check",
    "learning_requests_description_check",
    "learning_requests_goal_check",
    "learning_requests_version_check",
    "learning_requests_requested_expiry_mode_check",
    "learning_requests_published_expiry_check",
    "learning_requests_moderation_consistency_check",
    "learning_requests_preferred_slots_check",
    "learning_requests_flagged_rules_check",
  ]) {
    assert.ok(sql.includes(constraint), `missing constraint ${constraint}`);
  }
  assert.match(sql, /learning_requests_expiry_due_idx/i);
  assert.match(sql, /PENDING_MODERATION/i);
  assert.match(sql, /"preferred_slots" JSONB NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(sql, /"verified_teacher_only" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(sql, /"content_version" INTEGER NOT NULL DEFAULT 1/);
  assert.match(sql, /"flagged_rules" JSONB/);
  assert.doesNotMatch(sql, /CREATE TABLE "request_preferred_slots"/);
});

test("migration keeps feature-owned history relationships and avoids downstream tables", () => {
  assert.ok(existsSync(migrationPath), "missing Learning Request migration");
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /learning_request_tags_request_id_fkey/i);
  assert.match(sql, /learning_request_tags_tag_id_fkey/i);
  assert.doesNotMatch(
    sql,
    /CREATE TABLE "(proposals|conversations|schedule_proposals|sessions|credit_wallets)"/i,
  );
  assert.doesNotMatch(sql, /DROP TABLE/i);
});
