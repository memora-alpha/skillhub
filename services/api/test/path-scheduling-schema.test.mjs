import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${apiRoot}/${path}`, "utf8");
const runtimeSchema = read("prisma/schema.prisma");
const catalogSchema = read("prisma/catalog.prisma");
const v3Migration = read(
  "prisma/migrations/20261007000000_runtime_v3/migration.sql",
);
const constraintsMigration = read(
  "prisma/migrations/20261020000000_sh050_056_path_scheduling_constraints/migration.sql",
);
const models = [
  "LearningPath",
  "LearningPathVersion",
  "LearningPlan",
  "LearningPlanVersion",
  "PlanSessionOutline",
  "PathVersionPlan",
  "ScheduleProposal",
  "ScheduleVersion",
  "ScheduleItem",
  "Session",
  "SessionScheduleHistory",
  "CreditWallet",
  "HeldCreditAllocation",
  "CreditOperation",
  "CreditTransaction",
];
const constraints = [
  "learning_paths_participants_distinct_check",
  "learning_paths_current_version_positive_check",
  "learning_paths_locked_version_positive_check",
  "learning_paths_settlement_snapshot_complete_check",
  "learning_path_versions_terms_match_exchange_type_check",
  "learning_path_versions_version_positive_check",
  "learning_plans_participants_distinct_check",
  "learning_plans_current_version_positive_check",
  "learning_plan_versions_version_positive_check",
  "learning_plan_versions_total_sessions_positive_check",
  "plan_session_outlines_session_no_positive_check",
  "path_version_plans_versions_positive_check",
  "schedule_proposals_versions_valid_check",
  "schedule_versions_version_positive_check",
  "schedule_items_duration_valid_check",
  "schedule_items_versions_positive_check",
  "sessions_participants_distinct_check",
  "sessions_duration_valid_check",
  "sessions_attendance_nonnegative_check",
  "credit_wallets_balances_nonnegative_check",
  "credit_wallets_version_nonnegative_check",
  "held_credit_allocations_amount_valid_check",
  "credit_transactions_entry_positive_check",
  "credit_transactions_balances_nonnegative_check",
];

test("SH-050..056 models exist in both Prisma schemas and runtime migration", () => {
  for (const model of models) {
    assert.ok(
      runtimeSchema.includes(`model ${model} {`),
      `runtime missing ${model}`,
    );
    assert.ok(
      catalogSchema.includes(`model ${model} {`),
      `catalog missing ${model}`,
    );
  }
  for (const table of [
    "learning_paths",
    "learning_path_versions",
    "learning_plans",
    "learning_plan_versions",
    "plan_session_outlines",
    "path_version_plans",
    "schedule_proposals",
    "schedule_versions",
    "schedule_items",
    "sessions",
    "session_schedule_history",
    "credit_wallets",
    "held_credit_allocations",
    "credit_operations",
    "credit_transactions",
  ]) {
    assert.ok(
      v3Migration.includes(`CREATE TABLE "${table}"`),
      `migration missing ${table}`,
    );
  }
});

test("SH-050..056 migration enforces documented SQL invariants", () => {
  for (const constraint of constraints) {
    assert.ok(
      constraintsMigration.includes(`ADD CONSTRAINT "${constraint}"`),
      `missing ${constraint}`,
    );
    assert.ok(
      constraintsMigration.includes(`VALIDATE CONSTRAINT "${constraint}"`),
      `not validated: ${constraint}`,
    );
  }
  assert.match(
    constraintsMigration,
    /CREATE UNIQUE INDEX "session_schedule_history_one_current_per_session_key"[\s\S]*?WHERE "superseded_at" IS NULL;/,
  );
  assert.match(constraintsMigration, /INTERVAL '60 minutes'/);
  assert.match(constraintsMigration, /INTERVAL '180 minutes'/);
});
