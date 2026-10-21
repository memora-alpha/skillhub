BEGIN;

-- SH-050..056: database invariants for paths, plans, schedules, sessions and credit.
-- These tables already exist in runtime_v3; Prisma cannot represent CHECK constraints.
ALTER TABLE "learning_paths"
  ADD CONSTRAINT "learning_paths_participants_distinct_check"
    CHECK ("participant_a_id" <> "participant_b_id") NOT VALID,
  ADD CONSTRAINT "learning_paths_current_version_positive_check"
    CHECK ("current_version" > 0) NOT VALID,
  ADD CONSTRAINT "learning_paths_locked_version_positive_check"
    CHECK ("locked_version" IS NULL OR "locked_version" > 0) NOT VALID,
  ADD CONSTRAINT "learning_paths_settlement_snapshot_complete_check"
    CHECK (
      ("settled_path_version" IS NULL AND "settlement_operation_id" IS NULL
        AND "settlement_fee_policy_id" IS NULL AND "settlement_exchange_type" IS NULL
        AND "settlement_gross_amount" IS NULL AND "settlement_fee_amount" IS NULL
        AND "settlement_fee_snapshot" IS NULL AND "settled_at" IS NULL)
      OR
      ("settled_path_version" IS NOT NULL AND "settlement_operation_id" IS NOT NULL
        AND "settlement_fee_policy_id" IS NOT NULL AND "settlement_exchange_type" IS NOT NULL
        AND "settlement_gross_amount" IS NOT NULL AND "settlement_fee_amount" IS NOT NULL
        AND "settlement_fee_snapshot" IS NOT NULL AND "settled_at" IS NOT NULL
        AND "settlement_gross_amount" >= 0 AND "settlement_fee_amount" >= 0)
    ) NOT VALID;

ALTER TABLE "learning_path_versions"
  ADD CONSTRAINT "learning_path_versions_terms_match_exchange_type_check"
    CHECK (
      ("exchange_type" = 'TWO_WAY' AND "total_credit_per_user" IS NOT NULL
        AND "total_credit_per_user" > 0
        AND "negotiated_credit" IS NULL AND "teacher_id" IS NULL AND "learner_id" IS NULL)
      OR
      ("exchange_type" = 'ONE_WAY' AND "total_credit_per_user" IS NULL
        AND "negotiated_credit" IS NOT NULL AND "negotiated_credit" > 0
        AND "teacher_id" IS NOT NULL AND "learner_id" IS NOT NULL
        AND "teacher_id" <> "learner_id")
    ) NOT VALID,
  ADD CONSTRAINT "learning_path_versions_version_positive_check"
    CHECK ("version_no" > 0) NOT VALID;

ALTER TABLE "learning_plans"
  ADD CONSTRAINT "learning_plans_participants_distinct_check"
    CHECK ("teacher_id" <> "learner_id") NOT VALID,
  ADD CONSTRAINT "learning_plans_current_version_positive_check"
    CHECK ("current_version" > 0) NOT VALID;

ALTER TABLE "learning_plan_versions"
  ADD CONSTRAINT "learning_plan_versions_version_positive_check"
    CHECK ("version_no" > 0) NOT VALID,
  ADD CONSTRAINT "learning_plan_versions_total_sessions_positive_check"
    CHECK ("total_sessions" > 0) NOT VALID;

ALTER TABLE "plan_session_outlines"
  ADD CONSTRAINT "plan_session_outlines_session_no_positive_check"
    CHECK ("session_no" > 0) NOT VALID;

ALTER TABLE "path_version_plans"
  ADD CONSTRAINT "path_version_plans_versions_positive_check"
    CHECK ("path_version" > 0 AND "plan_version" > 0) NOT VALID;

ALTER TABLE "schedule_proposals"
  ADD CONSTRAINT "schedule_proposals_versions_valid_check"
    CHECK ("current_version" > 0 AND ("applied_version" IS NULL
      OR ("applied_version" > 0 AND "applied_version" <= "current_version"))) NOT VALID;

ALTER TABLE "schedule_versions"
  ADD CONSTRAINT "schedule_versions_version_positive_check"
    CHECK ("version_no" > 0 AND "path_version" > 0) NOT VALID;

ALTER TABLE "schedule_items"
  ADD CONSTRAINT "schedule_items_duration_valid_check"
    CHECK ("end_at" > "start_at"
      AND "end_at" - "start_at" >= INTERVAL '60 minutes'
      AND "end_at" - "start_at" <= INTERVAL '180 minutes') NOT VALID,
  ADD CONSTRAINT "schedule_items_versions_positive_check"
    CHECK ("schedule_version" > 0 AND "plan_version" > 0 AND "session_no" > 0) NOT VALID;

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_participants_distinct_check"
    CHECK ("teacher_id" <> "learner_id") NOT VALID,
  ADD CONSTRAINT "sessions_duration_valid_check"
    CHECK ("end_at" > "start_at"
      AND "end_at" - "start_at" >= INTERVAL '60 minutes'
      AND "end_at" - "start_at" <= INTERVAL '180 minutes') NOT VALID,
  ADD CONSTRAINT "sessions_attendance_nonnegative_check"
    CHECK ("teacher_attendance_seconds" >= 0 AND "learner_attendance_seconds" >= 0) NOT VALID;

ALTER TABLE "credit_wallets"
  ADD CONSTRAINT "credit_wallets_balances_nonnegative_check"
    CHECK ("available_credit" >= 0 AND "held_credit" >= 0
      AND "purchased_credit" >= 0 AND "bonus_credit" >= 0) NOT VALID,
  ADD CONSTRAINT "credit_wallets_version_nonnegative_check"
    CHECK ("wallet_version" >= 0) NOT VALID;

ALTER TABLE "held_credit_allocations"
  ADD CONSTRAINT "held_credit_allocations_amount_valid_check"
    CHECK ("amount" > 0 AND "remaining_held" >= 0 AND "remaining_held" <= "amount") NOT VALID;

ALTER TABLE "credit_transactions"
  ADD CONSTRAINT "credit_transactions_entry_positive_check"
    CHECK ("entry_no" > 0 AND "amount" > 0) NOT VALID,
  ADD CONSTRAINT "credit_transactions_balances_nonnegative_check"
    CHECK ("available_after" >= 0 AND "held_after" >= 0) NOT VALID;

CREATE UNIQUE INDEX "session_schedule_history_one_current_per_session_key"
  ON "session_schedule_history" ("session_id")
  WHERE "superseded_at" IS NULL;

ALTER TABLE "learning_paths" VALIDATE CONSTRAINT "learning_paths_participants_distinct_check";
ALTER TABLE "learning_paths" VALIDATE CONSTRAINT "learning_paths_current_version_positive_check";
ALTER TABLE "learning_paths" VALIDATE CONSTRAINT "learning_paths_locked_version_positive_check";
ALTER TABLE "learning_paths" VALIDATE CONSTRAINT "learning_paths_settlement_snapshot_complete_check";
ALTER TABLE "learning_path_versions" VALIDATE CONSTRAINT "learning_path_versions_terms_match_exchange_type_check";
ALTER TABLE "learning_path_versions" VALIDATE CONSTRAINT "learning_path_versions_version_positive_check";
ALTER TABLE "learning_plans" VALIDATE CONSTRAINT "learning_plans_participants_distinct_check";
ALTER TABLE "learning_plans" VALIDATE CONSTRAINT "learning_plans_current_version_positive_check";
ALTER TABLE "learning_plan_versions" VALIDATE CONSTRAINT "learning_plan_versions_version_positive_check";
ALTER TABLE "learning_plan_versions" VALIDATE CONSTRAINT "learning_plan_versions_total_sessions_positive_check";
ALTER TABLE "plan_session_outlines" VALIDATE CONSTRAINT "plan_session_outlines_session_no_positive_check";
ALTER TABLE "path_version_plans" VALIDATE CONSTRAINT "path_version_plans_versions_positive_check";
ALTER TABLE "schedule_proposals" VALIDATE CONSTRAINT "schedule_proposals_versions_valid_check";
ALTER TABLE "schedule_versions" VALIDATE CONSTRAINT "schedule_versions_version_positive_check";
ALTER TABLE "schedule_items" VALIDATE CONSTRAINT "schedule_items_duration_valid_check";
ALTER TABLE "schedule_items" VALIDATE CONSTRAINT "schedule_items_versions_positive_check";
ALTER TABLE "sessions" VALIDATE CONSTRAINT "sessions_participants_distinct_check";
ALTER TABLE "sessions" VALIDATE CONSTRAINT "sessions_duration_valid_check";
ALTER TABLE "sessions" VALIDATE CONSTRAINT "sessions_attendance_nonnegative_check";
ALTER TABLE "credit_wallets" VALIDATE CONSTRAINT "credit_wallets_balances_nonnegative_check";
ALTER TABLE "credit_wallets" VALIDATE CONSTRAINT "credit_wallets_version_nonnegative_check";
ALTER TABLE "held_credit_allocations" VALIDATE CONSTRAINT "held_credit_allocations_amount_valid_check";
ALTER TABLE "credit_transactions" VALIDATE CONSTRAINT "credit_transactions_entry_positive_check";
ALTER TABLE "credit_transactions" VALIDATE CONSTRAINT "credit_transactions_balances_nonnegative_check";

COMMIT;
