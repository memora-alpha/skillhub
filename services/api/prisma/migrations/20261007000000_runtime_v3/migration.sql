-- Upgrade implemented identity/foundation to the v3 domain model.
-- Backfill existing data before adding v3 tables and constraints.
BEGIN;
ALTER TABLE "users" RENAME COLUMN "id" TO "user_id";
ALTER TABLE "roles" RENAME COLUMN "id" TO "role_id";
ALTER TABLE "permissions" RENAME COLUMN "id" TO "permission_id";
ALTER TABLE "refresh_sessions" RENAME COLUMN "id" TO "session_id";
ALTER TABLE "refresh_credentials" RENAME COLUMN "id" TO "credential_id";
ALTER TABLE "refresh_credentials" RENAME COLUMN "consumed_at" TO "used_at";
ALTER TABLE "reauth_proofs" RENAME COLUMN "id" TO "proof_id";
ALTER TABLE "reauth_proofs" RENAME COLUMN "digest" TO "token_digest";
ALTER TABLE "reauth_proofs" RENAME COLUMN "consumed_at" TO "used_at";
ALTER TABLE "avatar_assets" RENAME COLUMN "id" TO "asset_id";
ALTER TABLE "avatar_assets" RENAME COLUMN "state" TO "status";
ALTER TABLE "avatar_assets" RENAME COLUMN "mime" TO "mime_type";
ALTER TABLE "avatar_assets" RENAME COLUMN "byte_size" TO "size_bytes";
ALTER TABLE "identity_email_deliveries" RENAME COLUMN "id" TO "delivery_id";
ALTER TABLE "audit_logs" RENAME COLUMN "id" TO "audit_id";
ALTER TABLE "audit_logs" RENAME COLUMN "before" TO "before_data";
ALTER TABLE "audit_logs" RENAME COLUMN "after" TO "after_data";
ALTER TABLE "system_configurations" RENAME COLUMN "key" TO "config_key";
ALTER TABLE "outbox_events" RENAME COLUMN "type" TO "event_type";
ALTER TABLE "outbox_events" RENAME COLUMN "version" TO "aggregate_version";
ALTER TABLE "outbox_events" RENAME COLUMN "delivered_at" TO "published_at";
ALTER TABLE "outbox_events" RENAME COLUMN "total_attempts" TO "attempts";
ALTER TYPE "ProfileLocale" RENAME TO "UserLocale";
ALTER INDEX users_created_at_id_idx RENAME TO users_created_at_user_id_idx;
ALTER INDEX users_account_status_created_at_id_idx RENAME TO users_account_status_created_at_user_id_idx;
ALTER INDEX avatar_assets_state_expires_at_idx RENAME TO avatar_assets_status_expires_at_idx;
ALTER TABLE system_configuration_revisions DROP CONSTRAINT system_configuration_revisions_key_fkey;
ALTER TABLE "users"
  ADD COLUMN "role_id" UUID,
  ADD COLUMN "full_name" VARCHAR(100),
  ADD COLUMN "headline" VARCHAR(120),
  ADD COLUMN "bio" VARCHAR(1000),
  ADD COLUMN "avatar_asset_id" UUID,
  ADD COLUMN "timezone" VARCHAR(64),
  ADD COLUMN "locale" "UserLocale",
  ADD COLUMN "reputation_score" SMALLINT DEFAULT 50,
  ADD COLUMN "verified_skill_count" INTEGER,
  ADD COLUMN "completed_session_count" INTEGER;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM users u LEFT JOIN profiles p ON p.user_id=u.user_id WHERE p.user_id IS NULL) THEN
    RAISE EXCEPTION 'V3 upgrade requires a profile for each existing user';
  END IF;
END $$;
INSERT INTO roles(role_id,code,description) VALUES (gen_random_uuid(),'USER','USER') ON CONFLICT(code) DO NOTHING;
UPDATE users u SET
  full_name=p.full_name, headline=p.headline, bio=p.bio,
  avatar_asset_id=p.avatar_asset_id, timezone=p.timezone, locale=p.locale,
  reputation_score=COALESCE(p.reputation_score,50),
  verified_skill_count=p.verified_skill_count, completed_session_count=p.completed_session_count
FROM profiles p WHERE p.user_id=u.user_id;
-- Preserve the highest existing administrative grant when collapsing membership.
UPDATE users u SET role_id=COALESCE(
  (SELECT r.role_id FROM user_roles ur JOIN roles r ON r.role_id=ur.role_id
   WHERE ur.user_id=u.user_id
   ORDER BY CASE r.code WHEN 'ADMIN' THEN 3 WHEN 'STAFF' THEN 2 ELSE 1 END DESC LIMIT 1),
  (SELECT role_id FROM roles WHERE code='USER'));
ALTER TABLE users
  ALTER COLUMN role_id SET NOT NULL, ALTER COLUMN full_name SET NOT NULL,
  ALTER COLUMN locale SET NOT NULL, ALTER COLUMN reputation_score SET NOT NULL,
  ALTER COLUMN verified_skill_count SET NOT NULL, ALTER COLUMN completed_session_count SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_profile_valid CHECK
 (char_length(full_name) BETWEEN 2 AND 100 AND reputation_score BETWEEN 0 AND 100
  AND verified_skill_count >= 0 AND completed_session_count >= 0);
-- Retain the original profile and grant history outside the runtime schema.
DO $$ DECLARE archive_schema TEXT := current_schema() || '_legacy_v3'; BEGIN
  EXECUTE format('CREATE SCHEMA %I', archive_schema);
  EXECUTE format('ALTER TABLE profiles SET SCHEMA %I', archive_schema);
  EXECUTE format('ALTER TABLE user_roles SET SCHEMA %I', archive_schema);
END $$;
UPDATE system_configurations SET value_type=COALESCE(value_type,jsonb_typeof(value));
ALTER TABLE audit_logs ALTER COLUMN actor_role TYPE VARCHAR(40) USING actor_role::text;
ALTER TABLE identity_email_deliveries ALTER COLUMN kind TYPE TEXT USING kind::text;
ALTER TABLE outbox_events
  ADD COLUMN aggregate_type TEXT,
  ADD COLUMN aggregate_id TEXT,
  ADD COLUMN dedupe_key TEXT;
UPDATE outbox_events SET aggregate_type=event_type, aggregate_id=event_id::text, dedupe_key=event_id::text;
ALTER TABLE outbox_events ALTER COLUMN aggregate_type SET NOT NULL,
  ALTER COLUMN aggregate_id SET NOT NULL, ALTER COLUMN dedupe_key SET NOT NULL;
-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SharingSkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "LearningLevel" AS ENUM ('NONE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "SkillVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationRequestStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EvidenceApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "LearningRequestStatus" AS ENUM ('DRAFT', 'PENDING_MODERATION', 'REJECTED', 'OPEN', 'NEGOTIATING', 'MATCHED', 'CLOSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProposalSourceType" AS ENUM ('LEARNING_REQUEST', 'DIRECT_SEARCH');

-- CreateEnum
CREATE TYPE "LearningPathStatus" AS ENUM ('DRAFT', 'PROPOSED', 'PARTIALLY_CONFIRMED', 'CONFIRMED', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "LearningPlanStatus" AS ENUM ('DRAFT', 'PROPOSED', 'CONFIRMED', 'NEEDS_REVISION');

-- CreateEnum
CREATE TYPE "ExchangeType" AS ENUM ('TWO_WAY', 'ONE_WAY');

-- CreateEnum
CREATE TYPE "FeePolicyCode" AS ENUM ('TWO_WAY', 'ONE_WAY', 'MATERIAL_PAID');

-- CreateEnum
CREATE TYPE "HoldPurpose" AS ENUM ('COMMITMENT', 'TEACHING_PAYMENT');

-- CreateEnum
CREATE TYPE "ScheduleProposalStatus" AS ENUM ('DRAFT', 'PROPOSED', 'PARTIALLY_CONFIRMED', 'LOCKED', 'NEEDS_REVISION', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('CONFIRMED', 'READY', 'ONGOING', 'AWAITING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('TOP_UP', 'DAILY_BONUS', 'FEEDBACK_BONUS', 'HOLD', 'RELEASE', 'PATH_RETURN', 'PLATFORM_FEE', 'TEACHING_PAYMENT', 'TEACHING_EARNING', 'MATERIAL_PURCHASE', 'MATERIAL_SALE', 'REFUND', 'PENALTY', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CreditReferenceType" AS ENUM ('PAYMENT', 'LEARNING_PATH', 'SESSION', 'REVIEW', 'DISPUTE', 'MATERIAL_ORDER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CreditTransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MaterialAccessType" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'HIDDEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EntitlementSourceType" AS ENUM ('FREE', 'PURCHASE');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'SESSION', 'REVIEW', 'MESSAGE', 'LEARNING_REQUEST', 'CREDIT_TRANSACTION', 'MATERIAL', 'MATERIAL_ORDER');

-- CreateEnum
CREATE TYPE "ReportCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'NEED_MORE_INFO', 'RESOLVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- DropForeignKey
ALTER TABLE "system_configurations" DROP CONSTRAINT "system_configurations_updated_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_role_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "refresh_sessions" DROP CONSTRAINT "refresh_sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "refresh_credentials" DROP CONSTRAINT "refresh_credentials_session_id_fkey";

-- DropForeignKey
ALTER TABLE "reauth_proofs" DROP CONSTRAINT "reauth_proofs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "reauth_proofs" DROP CONSTRAINT "reauth_proofs_user_id_session_id_fkey";

-- DropForeignKey
ALTER TABLE "identity_email_deliveries" DROP CONSTRAINT "identity_email_deliveries_user_id_fkey";

-- DropForeignKey
ALTER TABLE "avatar_assets" DROP CONSTRAINT "avatar_assets_user_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_id_fkey";

-- AlterTable
ALTER TABLE "system_configurations" DROP CONSTRAINT "system_configurations_pkey",
ALTER COLUMN "config_key" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "version" DROP DEFAULT,
ALTER COLUMN "effective_at" DROP DEFAULT,
ALTER COLUMN "value_type" SET NOT NULL,
ADD CONSTRAINT "system_configurations_pkey" PRIMARY KEY ("config_key");

-- AlterTable
ALTER TABLE "outbox_events" ALTER COLUMN "event_id" DROP DEFAULT,
ALTER COLUMN "event_type" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "account_status" DROP DEFAULT,
ALTER COLUMN "email_verified" DROP DEFAULT,
ALTER COLUMN "failed_login_count" DROP DEFAULT,
ALTER COLUMN "security_version" DROP DEFAULT,
ALTER COLUMN "terms_version" SET DATA TYPE VARCHAR(40);

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "description" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "code" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "description" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "refresh_sessions" ALTER COLUMN "remember_me" DROP DEFAULT,
ALTER COLUMN "current_generation" DROP DEFAULT;

-- AlterTable
ALTER TABLE "refresh_credentials" ADD COLUMN     "revoked_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "reauth_proofs" ADD COLUMN     "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "identity_email_deliveries" ALTER COLUMN "encryption_key_id" SET DATA TYPE VARCHAR(40),
ALTER COLUMN "next_attempt_at" DROP NOT NULL,
ALTER COLUMN "last_error_code" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "avatar_assets" ADD COLUMN     "checksum" TEXT,
ALTER COLUMN "mime_type" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "size_bytes" SET DATA TYPE BIGINT,
ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "action" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "target_type" SET DATA TYPE VARCHAR(100);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "oauth_account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" VARCHAR(255) NOT NULL,
    "linked_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("oauth_account_id")
);

-- CreateTable
CREATE TABLE "skill_categories" (
    "category_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "status" "CatalogStatus" NOT NULL,
    "parent_category_id" UUID,

    CONSTRAINT "skill_categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "skills" (
    "skill_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "category_id" UUID,
    "description" VARCHAR(500),
    "status" "CatalogStatus" NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("skill_id")
);

-- CreateTable
CREATE TABLE "sharing_skills" (
    "sharing_skill_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "level" "SharingSkillLevel" NOT NULL,
    "description" VARCHAR(1500) NOT NULL,
    "experience_years" DECIMAL(3,1),
    "verification_status" "SkillVerificationStatus" NOT NULL,
    "is_visible" BOOLEAN NOT NULL,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "sharing_skills_pkey" PRIMARY KEY ("sharing_skill_id")
);

-- CreateTable
CREATE TABLE "skill_verifications" (
    "verification_id" UUID NOT NULL,
    "sharing_skill_id" UUID NOT NULL,
    "status" "VerificationRequestStatus" NOT NULL,
    "reviewer_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "note" VARCHAR(500),
    "reject_reason" VARCHAR(500),
    "submitted_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "skill_verifications_pkey" PRIMARY KEY ("verification_id")
);

-- CreateTable
CREATE TABLE "skill_evidence" (
    "evidence_id" UUID NOT NULL,
    "verification_id" UUID NOT NULL,
    "sharing_skill_id" UUID NOT NULL,
    "title" VARCHAR(120),
    "description" VARCHAR(500),
    "mime_type" VARCHAR(100) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL,
    "approval_status" "EvidenceApprovalStatus" NOT NULL,
    "reviewer_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "approved_at" TIMESTAMPTZ(3),
    "reject_reason" VARCHAR(500),
    "revoked_by_user_id" UUID,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" TEXT,
    "scan_status" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,

    CONSTRAINT "skill_evidence_pkey" PRIMARY KEY ("evidence_id")
);

-- CreateTable
CREATE TABLE "user_learned_skills" (
    "learned_skill_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "source_path_id" UUID NOT NULL,
    "source_plan_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(3) NOT NULL,
    "completion_rule_version" VARCHAR(40) NOT NULL,

    CONSTRAINT "user_learned_skills_pkey" PRIMARY KEY ("learned_skill_id")
);

-- CreateTable
CREATE TABLE "learning_requests" (
    "request_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "learning_goal" VARCHAR(1000) NOT NULL,
    "preferred_slots" JSONB NOT NULL DEFAULT '[]',
    "current_level" "LearningLevel",
    "verified_teacher_only" BOOLEAN NOT NULL,
    "content_version" INTEGER NOT NULL,
    "moderation_status" TEXT NOT NULL,
    "flagged_rules" JSONB,
    "reject_reason" VARCHAR(500),
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "status" "LearningRequestStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "learning_requests_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "proposal_id" UUID NOT NULL,
    "source_type" "ProposalSourceType" NOT NULL,
    "request_id" UUID,
    "proposer_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "candidate_slots" JSONB NOT NULL DEFAULT '[]',
    "proposed_duration_minutes" SMALLINT,
    "proposed_credit" BIGINT,
    "initial_session_count" SMALLINT,
    "expires_at" TIMESTAMPTZ(3),
    "status" "ProposalStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("proposal_id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "conversation_id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "request_id" UUID,
    "participant_a_id" UUID NOT NULL,
    "participant_b_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("conversation_id")
);

-- CreateTable
CREATE TABLE "schedule_proposals" (
    "schedule_proposal_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "current_version" INTEGER NOT NULL,
    "applied_version" INTEGER,
    "status" "ScheduleProposalStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_proposals_pkey" PRIMARY KEY ("schedule_proposal_id")
);

-- CreateTable
CREATE TABLE "schedule_versions" (
    "schedule_proposal_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "path_id" UUID NOT NULL,
    "path_version" INTEGER NOT NULL,
    "participant_a_confirmed_at" TIMESTAMPTZ(3),
    "participant_b_confirmed_at" TIMESTAMPTZ(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_versions_pkey" PRIMARY KEY ("schedule_proposal_id","version_no")
);

-- CreateTable
CREATE TABLE "schedule_items" (
    "schedule_item_id" UUID NOT NULL,
    "schedule_proposal_id" UUID NOT NULL,
    "schedule_version" INTEGER NOT NULL,
    "plan_id" UUID NOT NULL,
    "plan_version" INTEGER NOT NULL,
    "session_no" INTEGER NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "schedule_items_pkey" PRIMARY KEY ("schedule_item_id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "session_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "plan_version" INTEGER NOT NULL,
    "outline_session_no" INTEGER NOT NULL,
    "teacher_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "SessionStatus" NOT NULL,
    "cancelled_by_user_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" TEXT,
    "teacher_confirmation_status" TEXT,
    "teacher_confirmed_at" TIMESTAMPTZ(3),
    "teacher_confirmation_note" VARCHAR(1000),
    "learner_confirmation_status" TEXT,
    "learner_confirmed_at" TIMESTAMPTZ(3),
    "learner_confirmation_note" VARCHAR(1000),
    "room_name" VARCHAR(255),
    "provider_room_id" TEXT,
    "room_metadata" JSONB,
    "teacher_first_joined_at" TIMESTAMPTZ(3),
    "teacher_last_left_at" TIMESTAMPTZ(3),
    "teacher_attendance_seconds" BIGINT NOT NULL DEFAULT 0,
    "learner_first_joined_at" TIMESTAMPTZ(3),
    "learner_last_left_at" TIMESTAMPTZ(3),
    "learner_attendance_seconds" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "credit_wallets" (
    "user_id" UUID NOT NULL,
    "available_credit" BIGINT NOT NULL,
    "held_credit" BIGINT NOT NULL,
    "purchased_credit" BIGINT NOT NULL,
    "bonus_credit" BIGINT NOT NULL,
    "wallet_version" INTEGER NOT NULL,

    CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "held_credit_allocations" (
    "allocation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "locked_path_version" INTEGER NOT NULL,
    "beneficiary_id" UUID,
    "purpose" "HoldPurpose" NOT NULL,
    "amount" BIGINT NOT NULL,
    "remaining_held" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMPTZ(3),

    CONSTRAINT "held_credit_allocations_pkey" PRIMARY KEY ("allocation_id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "transaction_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "entry_no" INTEGER NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "available_delta" BIGINT NOT NULL,
    "held_delta" BIGINT NOT NULL,
    "available_after" BIGINT NOT NULL,
    "held_after" BIGINT NOT NULL,
    "reverses_transaction_id" UUID,
    "status" "CreditTransactionStatus" NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "payment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "credit_amount" BIGINT NOT NULL,
    "payment_amount_vnd" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "gateway" VARCHAR(50) NOT NULL,
    "external_order_ref" VARCHAR(255),
    "gateway_transaction_id" VARCHAR(255),
    "status" "PaymentStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversion_rate_vnd_per_credit" INTEGER NOT NULL DEFAULT 1000,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "review_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "reviewee_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hidden_at" TIMESTAMPTZ(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("review_id")
);

-- CreateTable
CREATE TABLE "reputation_history" (
    "reputation_history_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "score_before" SMALLINT NOT NULL,
    "score_after" SMALLINT NOT NULL,
    "delta" SMALLINT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "rule_version" VARCHAR(40) NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "event_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reputation_history_pkey" PRIMARY KEY ("reputation_history_id")
);

-- CreateTable
CREATE TABLE "report_cases" (
    "case_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "related_session_id" UUID,
    "related_transaction_id" UUID,
    "reason_code" TEXT NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "status" "ReportCaseStatus" NOT NULL,
    "handler_id" UUID,
    "resolution_code" TEXT,
    "resolution_note" VARCHAR(2000),
    "resolved_by_user_id" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "related_path_id" UUID,
    "related_material_id" UUID,
    "related_order_id" UUID,
    "blocks_settlement" BOOLEAN NOT NULL,

    CONSTRAINT "report_cases_pkey" PRIMARY KEY ("case_id")
);

-- CreateTable
CREATE TABLE "report_evidence" (
    "evidence_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "report_evidence_pkey" PRIMARY KEY ("evidence_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "channel" "NotificationChannel" NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "learning_paths" (
    "path_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "participant_a_id" UUID NOT NULL,
    "participant_b_id" UUID NOT NULL,
    "current_version" INTEGER NOT NULL,
    "locked_version" INTEGER,
    "status" "LearningPathStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "settled_path_version" INTEGER,
    "settlement_operation_id" UUID,
    "settlement_fee_policy_id" UUID,
    "settlement_exchange_type" "ExchangeType",
    "settlement_gross_amount" BIGINT,
    "settlement_fee_amount" BIGINT,
    "settlement_fee_snapshot" JSONB,
    "settled_at" TIMESTAMPTZ(3),

    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("path_id")
);

-- CreateTable
CREATE TABLE "learning_path_versions" (
    "path_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "exchange_type" "ExchangeType" NOT NULL,
    "total_credit_per_user" BIGINT,
    "negotiated_credit" BIGINT,
    "teacher_id" UUID,
    "learner_id" UUID,
    "fee_policy_id" UUID,
    "fee_rate_snapshot" DECIMAL(12,8),
    "fee_amount_snapshot" BIGINT,
    "rounding_snapshot" JSONB,
    "participant_a_confirmed_at" TIMESTAMPTZ(3),
    "participant_b_confirmed_at" TIMESTAMPTZ(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_path_versions_pkey" PRIMARY KEY ("path_id","version_no")
);

-- CreateTable
CREATE TABLE "learning_plans" (
    "plan_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "current_version" INTEGER NOT NULL,
    "status" "LearningPlanStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "learning_plans_pkey" PRIMARY KEY ("plan_id")
);

-- CreateTable
CREATE TABLE "learning_plan_versions" (
    "plan_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "skill_id" UUID NOT NULL,
    "learning_goal" VARCHAR(1500) NOT NULL,
    "total_sessions" INTEGER NOT NULL,
    "learner_confirmed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_plan_versions_pkey" PRIMARY KEY ("plan_id","version_no")
);

-- CreateTable
CREATE TABLE "plan_session_outlines" (
    "plan_id" UUID NOT NULL,
    "plan_version" INTEGER NOT NULL,
    "session_no" INTEGER NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "plan_session_outlines_pkey" PRIMARY KEY ("plan_id","plan_version","session_no")
);

-- CreateTable
CREATE TABLE "path_version_plans" (
    "path_id" UUID NOT NULL,
    "path_version" INTEGER NOT NULL,
    "plan_id" UUID NOT NULL,
    "plan_version" INTEGER NOT NULL,

    CONSTRAINT "path_version_plans_pkey" PRIMARY KEY ("path_id","path_version","plan_id")
);

-- CreateTable
CREATE TABLE "session_schedule_history" (
    "history_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "schedule_item_id" UUID NOT NULL,
    "applied_at" TIMESTAMPTZ(3) NOT NULL,
    "superseded_at" TIMESTAMPTZ(3),

    CONSTRAINT "session_schedule_history_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "fee_policy_versions" (
    "policy_id" UUID NOT NULL,
    "policy_code" "FeePolicyCode" NOT NULL,
    "version_no" INTEGER NOT NULL,
    "calculation_rule" JSONB NOT NULL,
    "rounding_rule" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "approved_at" TIMESTAMPTZ(3),
    "effective_at" TIMESTAMPTZ(3),
    "approved_by_user_id" UUID,

    CONSTRAINT "fee_policy_versions_pkey" PRIMARY KEY ("policy_id")
);

-- CreateTable
CREATE TABLE "credit_operations" (
    "operation_id" UUID NOT NULL,
    "operation_type" TEXT NOT NULL,
    "reference_type" "CreditReferenceType" NOT NULL,
    "reference_id" TEXT NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_operations_pkey" PRIMARY KEY ("operation_id")
);

-- CreateTable
CREATE TABLE "materials" (
    "material_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "access_type" "MaterialAccessType" NOT NULL,
    "price_credit" BIGINT NOT NULL,
    "storage_key" TEXT,
    "original_filename" TEXT,
    "mime_type" VARCHAR(100),
    "size_bytes" BIGINT,
    "checksum" TEXT,
    "scan_status" TEXT,
    "distribution_rights_confirmed_at" TIMESTAMPTZ(3),
    "uploaded_at" TIMESTAMPTZ(3),
    "listing_version" INTEGER NOT NULL,
    "moderation_status" TEXT NOT NULL,
    "status" "MaterialStatus" NOT NULL,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "reject_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("material_id")
);

-- CreateTable
CREATE TABLE "material_orders" (
    "order_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "purchased_file_snapshot" JSONB NOT NULL,
    "listing_version" INTEGER NOT NULL,
    "gross_credit" BIGINT NOT NULL,
    "fee_amount" BIGINT NOT NULL,
    "seller_net_credit" BIGINT NOT NULL,
    "fee_policy_id" UUID NOT NULL,
    "fee_snapshot" JSONB NOT NULL,
    "operation_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_orders_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "material_entitlements" (
    "entitlement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "source_order_id" UUID,
    "source_type" "EntitlementSourceType" NOT NULL,
    "status" TEXT NOT NULL,
    "granted_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" TEXT,

    CONSTRAINT "material_entitlements_pkey" PRIMARY KEY ("entitlement_id")
);

-- CreateTable
CREATE TABLE "user_restrictions" (
    "restriction_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "applied_by_user_id" UUID,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "user_restrictions_pkey" PRIMARY KEY ("restriction_id")
);

-- CreateIndex
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_account_id_key" ON "oauth_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_categories_name_key" ON "skill_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "skill_categories_slug_key" ON "skill_categories"("slug");

-- CreateIndex
CREATE INDEX "skill_categories_parent_category_id_idx" ON "skill_categories"("parent_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE UNIQUE INDEX "skills_slug_key" ON "skills"("slug");

-- CreateIndex
CREATE INDEX "skills_category_id_idx" ON "skills"("category_id");

-- CreateIndex
CREATE INDEX "sharing_skills_user_id_idx" ON "sharing_skills"("user_id");

-- CreateIndex
CREATE INDEX "sharing_skills_skill_id_idx" ON "sharing_skills"("skill_id");

-- CreateIndex
CREATE INDEX "skill_verifications_sharing_skill_id_idx" ON "skill_verifications"("sharing_skill_id");

-- CreateIndex
CREATE INDEX "skill_verifications_reviewer_id_idx" ON "skill_verifications"("reviewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_verifications_verification_id_sharing_skill_id_key" ON "skill_verifications"("verification_id", "sharing_skill_id");

-- CreateIndex
CREATE INDEX "skill_evidence_verification_id_sharing_skill_id_idx" ON "skill_evidence"("verification_id", "sharing_skill_id");

-- CreateIndex
CREATE INDEX "skill_evidence_reviewer_id_idx" ON "skill_evidence"("reviewer_id");

-- CreateIndex
CREATE INDEX "skill_evidence_revoked_by_user_id_idx" ON "skill_evidence"("revoked_by_user_id");

-- CreateIndex
CREATE INDEX "user_learned_skills_source_plan_id_source_path_id_idx" ON "user_learned_skills"("source_plan_id", "source_path_id");

-- CreateIndex
CREATE INDEX "user_learned_skills_user_id_idx" ON "user_learned_skills"("user_id");

-- CreateIndex
CREATE INDEX "user_learned_skills_skill_id_idx" ON "user_learned_skills"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_learned_skills_user_id_skill_id_source_plan_id_key" ON "user_learned_skills"("user_id", "skill_id", "source_plan_id");

-- CreateIndex
CREATE INDEX "learning_requests_owner_id_idx" ON "learning_requests"("owner_id");

-- CreateIndex
CREATE INDEX "learning_requests_skill_id_idx" ON "learning_requests"("skill_id");

-- CreateIndex
CREATE INDEX "learning_requests_reviewed_by_user_id_idx" ON "learning_requests"("reviewed_by_user_id");

-- CreateIndex
CREATE INDEX "proposals_request_id_idx" ON "proposals"("request_id");

-- CreateIndex
CREATE INDEX "proposals_proposer_id_idx" ON "proposals"("proposer_id");

-- CreateIndex
CREATE INDEX "proposals_recipient_id_idx" ON "proposals"("recipient_id");

-- CreateIndex
CREATE INDEX "proposals_skill_id_idx" ON "proposals"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_proposal_id_key" ON "conversations"("proposal_id");

-- CreateIndex
CREATE INDEX "conversations_proposal_id_idx" ON "conversations"("proposal_id");

-- CreateIndex
CREATE INDEX "conversations_request_id_idx" ON "conversations"("request_id");

-- CreateIndex
CREATE INDEX "conversations_participant_a_id_idx" ON "conversations"("participant_a_id");

-- CreateIndex
CREATE INDEX "conversations_participant_b_id_idx" ON "conversations"("participant_b_id");

-- CreateIndex
CREATE INDEX "schedule_proposals_path_id_idx" ON "schedule_proposals"("path_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_proposals_schedule_proposal_id_path_id_key" ON "schedule_proposals"("schedule_proposal_id", "path_id");

-- CreateIndex
CREATE INDEX "schedule_versions_schedule_proposal_id_path_id_idx" ON "schedule_versions"("schedule_proposal_id", "path_id");

-- CreateIndex
CREATE INDEX "schedule_versions_path_id_path_version_idx" ON "schedule_versions"("path_id", "path_version");

-- CreateIndex
CREATE INDEX "schedule_versions_created_by_user_id_idx" ON "schedule_versions"("created_by_user_id");

-- CreateIndex
CREATE INDEX "schedule_items_schedule_proposal_id_schedule_version_idx" ON "schedule_items"("schedule_proposal_id", "schedule_version");

-- CreateIndex
CREATE INDEX "schedule_items_plan_id_plan_version_session_no_idx" ON "schedule_items"("plan_id", "plan_version", "session_no");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_items_schedule_proposal_id_schedule_version_plan_i_key" ON "schedule_items"("schedule_proposal_id", "schedule_version", "plan_id", "plan_version", "session_no");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_room_name_key" ON "sessions"("room_name");

-- CreateIndex
CREATE INDEX "sessions_plan_id_path_id_idx" ON "sessions"("plan_id", "path_id");

-- CreateIndex
CREATE INDEX "sessions_teacher_id_idx" ON "sessions"("teacher_id");

-- CreateIndex
CREATE INDEX "sessions_learner_id_idx" ON "sessions"("learner_id");

-- CreateIndex
CREATE INDEX "sessions_cancelled_by_user_id_idx" ON "sessions"("cancelled_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_plan_id_plan_version_outline_session_no_key" ON "sessions"("plan_id", "plan_version", "outline_session_no");

-- CreateIndex
CREATE INDEX "held_credit_allocations_path_id_locked_path_version_idx" ON "held_credit_allocations"("path_id", "locked_path_version");

-- CreateIndex
CREATE INDEX "held_credit_allocations_user_id_idx" ON "held_credit_allocations"("user_id");

-- CreateIndex
CREATE INDEX "held_credit_allocations_beneficiary_id_idx" ON "held_credit_allocations"("beneficiary_id");

-- CreateIndex
CREATE UNIQUE INDEX "held_credit_allocations_path_id_user_id_key" ON "held_credit_allocations"("path_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_idempotency_key_key" ON "credit_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "credit_transactions_user_id_idx" ON "credit_transactions"("user_id");

-- CreateIndex
CREATE INDEX "credit_transactions_operation_id_idx" ON "credit_transactions"("operation_id");

-- CreateIndex
CREATE INDEX "credit_transactions_reverses_transaction_id_idx" ON "credit_transactions"("reverses_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_operation_id_entry_no_key" ON "credit_transactions"("operation_id", "entry_no");

-- CreateIndex
CREATE UNIQUE INDEX "payments_external_order_ref_key" ON "payments"("external_order_ref");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_gateway_transaction_id_key" ON "payments"("gateway", "gateway_transaction_id");

-- CreateIndex
CREATE INDEX "reviews_path_id_idx" ON "reviews"("path_id");

-- CreateIndex
CREATE INDEX "reviews_reviewer_id_idx" ON "reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "reviews_reviewee_id_idx" ON "reviews"("reviewee_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_path_id_reviewer_id_key" ON "reviews"("path_id", "reviewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "reputation_history_event_key_key" ON "reputation_history"("event_key");

-- CreateIndex
CREATE INDEX "reputation_history_user_id_idx" ON "reputation_history"("user_id");

-- CreateIndex
CREATE INDEX "report_cases_reporter_id_idx" ON "report_cases"("reporter_id");

-- CreateIndex
CREATE INDEX "report_cases_related_session_id_idx" ON "report_cases"("related_session_id");

-- CreateIndex
CREATE INDEX "report_cases_related_transaction_id_idx" ON "report_cases"("related_transaction_id");

-- CreateIndex
CREATE INDEX "report_cases_handler_id_idx" ON "report_cases"("handler_id");

-- CreateIndex
CREATE INDEX "report_cases_resolved_by_user_id_idx" ON "report_cases"("resolved_by_user_id");

-- CreateIndex
CREATE INDEX "report_cases_related_path_id_idx" ON "report_cases"("related_path_id");

-- CreateIndex
CREATE INDEX "report_cases_related_material_id_idx" ON "report_cases"("related_material_id");

-- CreateIndex
CREATE INDEX "report_cases_related_order_id_idx" ON "report_cases"("related_order_id");

-- CreateIndex
CREATE INDEX "report_evidence_case_id_idx" ON "report_evidence"("case_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_paths_settlement_operation_id_key" ON "learning_paths"("settlement_operation_id");

-- CreateIndex
CREATE INDEX "learning_paths_conversation_id_idx" ON "learning_paths"("conversation_id");

-- CreateIndex
CREATE INDEX "learning_paths_participant_a_id_idx" ON "learning_paths"("participant_a_id");

-- CreateIndex
CREATE INDEX "learning_paths_participant_b_id_idx" ON "learning_paths"("participant_b_id");

-- CreateIndex
CREATE INDEX "learning_paths_settlement_operation_id_idx" ON "learning_paths"("settlement_operation_id");

-- CreateIndex
CREATE INDEX "learning_paths_settlement_fee_policy_id_idx" ON "learning_paths"("settlement_fee_policy_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_paths_path_id_settled_path_version_key" ON "learning_paths"("path_id", "settled_path_version");

-- CreateIndex
CREATE INDEX "learning_path_versions_path_id_idx" ON "learning_path_versions"("path_id");

-- CreateIndex
CREATE INDEX "learning_path_versions_teacher_id_idx" ON "learning_path_versions"("teacher_id");

-- CreateIndex
CREATE INDEX "learning_path_versions_learner_id_idx" ON "learning_path_versions"("learner_id");

-- CreateIndex
CREATE INDEX "learning_path_versions_fee_policy_id_idx" ON "learning_path_versions"("fee_policy_id");

-- CreateIndex
CREATE INDEX "learning_path_versions_created_by_user_id_idx" ON "learning_path_versions"("created_by_user_id");

-- CreateIndex
CREATE INDEX "learning_plans_path_id_idx" ON "learning_plans"("path_id");

-- CreateIndex
CREATE INDEX "learning_plans_teacher_id_idx" ON "learning_plans"("teacher_id");

-- CreateIndex
CREATE INDEX "learning_plans_learner_id_idx" ON "learning_plans"("learner_id");

-- CreateIndex
CREATE INDEX "learning_plans_created_by_user_id_idx" ON "learning_plans"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_plans_path_id_teacher_id_learner_id_key" ON "learning_plans"("path_id", "teacher_id", "learner_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_plans_plan_id_path_id_key" ON "learning_plans"("plan_id", "path_id");

-- CreateIndex
CREATE INDEX "learning_plan_versions_plan_id_idx" ON "learning_plan_versions"("plan_id");

-- CreateIndex
CREATE INDEX "learning_plan_versions_skill_id_idx" ON "learning_plan_versions"("skill_id");

-- CreateIndex
CREATE INDEX "plan_session_outlines_plan_id_plan_version_idx" ON "plan_session_outlines"("plan_id", "plan_version");

-- CreateIndex
CREATE INDEX "path_version_plans_path_id_path_version_idx" ON "path_version_plans"("path_id", "path_version");

-- CreateIndex
CREATE INDEX "path_version_plans_plan_id_plan_version_idx" ON "path_version_plans"("plan_id", "plan_version");

-- CreateIndex
CREATE INDEX "path_version_plans_plan_id_path_id_idx" ON "path_version_plans"("plan_id", "path_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_schedule_history_schedule_item_id_key" ON "session_schedule_history"("schedule_item_id");

-- CreateIndex
CREATE INDEX "session_schedule_history_session_id_idx" ON "session_schedule_history"("session_id");

-- CreateIndex
CREATE INDEX "session_schedule_history_schedule_item_id_idx" ON "session_schedule_history"("schedule_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_schedule_history_session_id_schedule_item_id_key" ON "session_schedule_history"("session_id", "schedule_item_id");

-- CreateIndex
CREATE INDEX "fee_policy_versions_approved_by_user_id_idx" ON "fee_policy_versions"("approved_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fee_policy_versions_policy_code_version_no_key" ON "fee_policy_versions"("policy_code", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "credit_operations_idempotency_key_key" ON "credit_operations"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "materials_storage_key_key" ON "materials"("storage_key");

-- CreateIndex
CREATE INDEX "materials_owner_id_idx" ON "materials"("owner_id");

-- CreateIndex
CREATE INDEX "materials_skill_id_idx" ON "materials"("skill_id");

-- CreateIndex
CREATE INDEX "materials_reviewed_by_user_id_idx" ON "materials"("reviewed_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_orders_operation_id_key" ON "material_orders"("operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_orders_idempotency_key_key" ON "material_orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "material_orders_buyer_id_idx" ON "material_orders"("buyer_id");

-- CreateIndex
CREATE INDEX "material_orders_seller_id_idx" ON "material_orders"("seller_id");

-- CreateIndex
CREATE INDEX "material_orders_material_id_idx" ON "material_orders"("material_id");

-- CreateIndex
CREATE INDEX "material_orders_fee_policy_id_idx" ON "material_orders"("fee_policy_id");

-- CreateIndex
CREATE INDEX "material_orders_operation_id_idx" ON "material_orders"("operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_entitlements_source_order_id_key" ON "material_entitlements"("source_order_id");

-- CreateIndex
CREATE INDEX "material_entitlements_user_id_idx" ON "material_entitlements"("user_id");

-- CreateIndex
CREATE INDEX "material_entitlements_material_id_idx" ON "material_entitlements"("material_id");

-- CreateIndex
CREATE INDEX "material_entitlements_source_order_id_idx" ON "material_entitlements"("source_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_entitlements_user_id_material_id_key" ON "material_entitlements"("user_id", "material_id");

-- CreateIndex
CREATE INDEX "user_restrictions_user_id_idx" ON "user_restrictions"("user_id");

-- CreateIndex
CREATE INDEX "user_restrictions_applied_by_user_id_idx" ON "user_restrictions"("applied_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_dedupe_key_key" ON "outbox_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_id_avatar_asset_id_key" ON "users"("user_id", "avatar_asset_id");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_idx" ON "refresh_sessions"("user_id");

-- CreateIndex
CREATE INDEX "refresh_credentials_session_id_idx" ON "refresh_credentials"("session_id");

-- CreateIndex
CREATE INDEX "avatar_assets_user_id_idx" ON "avatar_assets"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_user_id_avatar_asset_id_fkey" FOREIGN KEY ("user_id", "avatar_asset_id") REFERENCES "avatar_assets"("user_id", "asset_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("permission_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_categories" ADD CONSTRAINT "skill_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "skill_categories"("category_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "skill_categories"("category_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sharing_skills" ADD CONSTRAINT "sharing_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sharing_skills" ADD CONSTRAINT "sharing_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("skill_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_verifications" ADD CONSTRAINT "skill_verifications_sharing_skill_id_fkey" FOREIGN KEY ("sharing_skill_id") REFERENCES "sharing_skills"("sharing_skill_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_verifications" ADD CONSTRAINT "skill_verifications_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_evidence" ADD CONSTRAINT "skill_evidence_verification_id_sharing_skill_id_fkey" FOREIGN KEY ("verification_id", "sharing_skill_id") REFERENCES "skill_verifications"("verification_id", "sharing_skill_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_evidence" ADD CONSTRAINT "skill_evidence_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_evidence" ADD CONSTRAINT "skill_evidence_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_learned_skills" ADD CONSTRAINT "user_learned_skills_source_plan_id_source_path_id_fkey" FOREIGN KEY ("source_plan_id", "source_path_id") REFERENCES "learning_plans"("plan_id", "path_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_learned_skills" ADD CONSTRAINT "user_learned_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_learned_skills" ADD CONSTRAINT "user_learned_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("skill_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_requests" ADD CONSTRAINT "learning_requests_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_requests" ADD CONSTRAINT "learning_requests_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("skill_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_requests" ADD CONSTRAINT "learning_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "learning_requests"("request_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_proposer_id_fkey" FOREIGN KEY ("proposer_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("skill_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("proposal_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "learning_requests"("request_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant_a_id_fkey" FOREIGN KEY ("participant_a_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant_b_id_fkey" FOREIGN KEY ("participant_b_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "schedule_proposals" ADD CONSTRAINT "schedule_proposals_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("path_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_schedule_proposal_id_path_id_fkey" FOREIGN KEY ("schedule_proposal_id", "path_id") REFERENCES "schedule_proposals"("schedule_proposal_id", "path_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_path_id_path_version_fkey" FOREIGN KEY ("path_id", "path_version") REFERENCES "learning_path_versions"("path_id", "version_no") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "schedule_items" ADD CONSTRAINT "schedule_items_schedule_proposal_id_schedule_version_fkey" FOREIGN KEY ("schedule_proposal_id", "schedule_version") REFERENCES "schedule_versions"("schedule_proposal_id", "version_no") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "schedule_items" ADD CONSTRAINT "schedule_items_plan_id_plan_version_session_no_fkey" FOREIGN KEY ("plan_id", "plan_version", "session_no") REFERENCES "plan_session_outlines"("plan_id", "plan_version", "session_no") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_plan_id_plan_version_outline_session_no_fkey" FOREIGN KEY ("plan_id", "plan_version", "outline_session_no") REFERENCES "plan_session_outlines"("plan_id", "plan_version", "session_no") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_plan_id_path_id_fkey" FOREIGN KEY ("plan_id", "path_id") REFERENCES "learning_plans"("plan_id", "path_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "held_credit_allocations" ADD CONSTRAINT "held_credit_allocations_path_id_locked_path_version_fkey" FOREIGN KEY ("path_id", "locked_path_version") REFERENCES "learning_path_versions"("path_id", "version_no") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "held_credit_allocations" ADD CONSTRAINT "held_credit_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "held_credit_allocations" ADD CONSTRAINT "held_credit_allocations_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "credit_wallets"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "credit_operations"("operation_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_reverses_transaction_id_fkey" FOREIGN KEY ("reverses_transaction_id") REFERENCES "credit_transactions"("transaction_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "system_configurations" ADD CONSTRAINT "system_configurations_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("path_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reputation_history" ADD CONSTRAINT "reputation_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_cases" ADD CONSTRAINT "report_cases_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_cases" ADD CONSTRAINT "report_cases_related_session_id_fkey" FOREIGN KEY ("related_session_id") REFERENCES "sessions"("session_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_cases" ADD CONSTRAINT "report_cases_related_transaction_id_fkey" FOREIGN KEY ("related_transaction_id") REFERENCES "credit_transactions"("transaction_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_cases" ADD CONSTRAINT "report_cases_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_cases" ADD CONSTRAINT "report_cases_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_cases" ADD CONSTRAINT "report_cases_related_path_id_fkey" FOREIGN KEY ("related_path_id") REFERENCES "learning_paths"("path_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_cases" ADD CONSTRAINT "report_cases_related_material_id_fkey" FOREIGN KEY ("related_material_id") REFERENCES "materials"("material_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_cases" ADD CONSTRAINT "report_cases_related_order_id_fkey" FOREIGN KEY ("related_order_id") REFERENCES "material_orders"("order_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_evidence" ADD CONSTRAINT "report_evidence_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "report_cases"("case_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "refresh_credentials" ADD CONSTRAINT "refresh_credentials_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "refresh_sessions"("session_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reauth_proofs" ADD CONSTRAINT "reauth_proofs_user_id_session_id_fkey" FOREIGN KEY ("user_id", "session_id") REFERENCES "refresh_sessions"("user_id", "session_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "avatar_assets" ADD CONSTRAINT "avatar_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "identity_email_deliveries" ADD CONSTRAINT "identity_email_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_path_id_settled_path_version_fkey" FOREIGN KEY ("path_id", "settled_path_version") REFERENCES "learning_path_versions"("path_id", "version_no") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("conversation_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_participant_a_id_fkey" FOREIGN KEY ("participant_a_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_participant_b_id_fkey" FOREIGN KEY ("participant_b_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_settlement_operation_id_fkey" FOREIGN KEY ("settlement_operation_id") REFERENCES "credit_operations"("operation_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_settlement_fee_policy_id_fkey" FOREIGN KEY ("settlement_fee_policy_id") REFERENCES "fee_policy_versions"("policy_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_path_versions" ADD CONSTRAINT "learning_path_versions_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("path_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_path_versions" ADD CONSTRAINT "learning_path_versions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_path_versions" ADD CONSTRAINT "learning_path_versions_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_path_versions" ADD CONSTRAINT "learning_path_versions_fee_policy_id_fkey" FOREIGN KEY ("fee_policy_id") REFERENCES "fee_policy_versions"("policy_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_path_versions" ADD CONSTRAINT "learning_path_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_plans" ADD CONSTRAINT "learning_plans_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("path_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_plans" ADD CONSTRAINT "learning_plans_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_plans" ADD CONSTRAINT "learning_plans_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_plans" ADD CONSTRAINT "learning_plans_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_plan_versions" ADD CONSTRAINT "learning_plan_versions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "learning_plans"("plan_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_plan_versions" ADD CONSTRAINT "learning_plan_versions_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("skill_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "plan_session_outlines" ADD CONSTRAINT "plan_session_outlines_plan_id_plan_version_fkey" FOREIGN KEY ("plan_id", "plan_version") REFERENCES "learning_plan_versions"("plan_id", "version_no") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "path_version_plans" ADD CONSTRAINT "path_version_plans_path_id_path_version_fkey" FOREIGN KEY ("path_id", "path_version") REFERENCES "learning_path_versions"("path_id", "version_no") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "path_version_plans" ADD CONSTRAINT "path_version_plans_plan_id_plan_version_fkey" FOREIGN KEY ("plan_id", "plan_version") REFERENCES "learning_plan_versions"("plan_id", "version_no") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "path_version_plans" ADD CONSTRAINT "path_version_plans_plan_id_path_id_fkey" FOREIGN KEY ("plan_id", "path_id") REFERENCES "learning_plans"("plan_id", "path_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "session_schedule_history" ADD CONSTRAINT "session_schedule_history_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "session_schedule_history" ADD CONSTRAINT "session_schedule_history_schedule_item_id_fkey" FOREIGN KEY ("schedule_item_id") REFERENCES "schedule_items"("schedule_item_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "fee_policy_versions" ADD CONSTRAINT "fee_policy_versions_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("skill_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "material_orders" ADD CONSTRAINT "material_orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "material_orders" ADD CONSTRAINT "material_orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "material_orders" ADD CONSTRAINT "material_orders_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("material_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "material_orders" ADD CONSTRAINT "material_orders_fee_policy_id_fkey" FOREIGN KEY ("fee_policy_id") REFERENCES "fee_policy_versions"("policy_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "material_orders" ADD CONSTRAINT "material_orders_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "credit_operations"("operation_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "material_entitlements" ADD CONSTRAINT "material_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "material_entitlements" ADD CONSTRAINT "material_entitlements_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("material_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "material_entitlements" ADD CONSTRAINT "material_entitlements_source_order_id_fkey" FOREIGN KEY ("source_order_id") REFERENCES "material_orders"("order_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_applied_by_user_id_fkey" FOREIGN KEY ("applied_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE system_configuration_revisions ADD CONSTRAINT system_configuration_revisions_key_fkey FOREIGN KEY (key) REFERENCES system_configurations(config_key) ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
