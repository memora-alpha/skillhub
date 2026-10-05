-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('USER', 'STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProfileLocale" AS ENUM ('vi', 'en');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'RESET_PASSWORD', 'CHANGE_EMAIL');

-- CreateEnum
CREATE TYPE "ReauthPurpose" AS ENUM ('STAFF_ROLE_CHANGE');

-- CreateEnum
CREATE TYPE "IdentityEmailKind" AS ENUM ('REGISTER_OTP', 'RESET_OTP', 'PASSWORD_CHANGED');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'LEASED', 'SENT', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AvatarAssetStatus" AS ENUM ('QUARANTINED', 'CLEAN', 'REJECTED', 'DELETED');

-- AlterTable
ALTER TABLE "system_configurations" ADD COLUMN     "updated_by_user_id" UUID,
ADD COLUMN     "value_type" TEXT;

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "normalized_email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT,
    "account_status" "AccountStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMPTZ(3),
    "security_version" INTEGER NOT NULL DEFAULT 0,
    "terms_version" TEXT NOT NULL,
    "terms_accepted_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "user_id" UUID NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "headline" VARCHAR(120) NOT NULL DEFAULT '',
    "bio" VARCHAR(1000) NOT NULL DEFAULT '',
    "timezone" TEXT,
    "locale" "ProfileLocale" NOT NULL DEFAULT 'vi',
    "avatar_asset_id" UUID,
    "reputation_score" INTEGER,
    "verified_skill_count" INTEGER NOT NULL DEFAULT 0,
    "completed_session_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" "RoleCode" NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "verifier_digest" BYTEA NOT NULL,
    "verifier_key_id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "superseded_at" TIMESTAMPTZ(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_issue_windows" (
    "normalized_email" VARCHAR(254) NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "window_start" TIMESTAMPTZ(3) NOT NULL,
    "issue_count" INTEGER NOT NULL DEFAULT 0,
    "resend_count" INTEGER NOT NULL DEFAULT 0,
    "last_issued_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "otp_issue_windows_pkey" PRIMARY KEY ("normalized_email","purpose","window_start")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "security_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "absolute_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "remember_me" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" TEXT,
    "current_generation" INTEGER NOT NULL DEFAULT 0,
    "device_metadata" JSONB,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_credentials" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "generation" INTEGER NOT NULL,
    "token_digest" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),

    CONSTRAINT "refresh_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reauth_proofs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "digest" BYTEA NOT NULL,
    "security_version" INTEGER NOT NULL,
    "purpose" "ReauthPurpose" NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),

    CONSTRAINT "reauth_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_email_deliveries" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "challenge_id" UUID,
    "kind" "IdentityEmailKind" NOT NULL,
    "encrypted_recipient" BYTEA NOT NULL,
    "encrypted_payload" BYTEA,
    "encryption_key_id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_until" TIMESTAMPTZ(3),
    "provider_message_id" TEXT,
    "last_error_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(3),

    CONSTRAINT "identity_email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avatar_assets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "state" "AvatarAssetStatus" NOT NULL DEFAULT 'QUARANTINED',
    "scan_evidence" JSONB,
    "checked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3),

    CONSTRAINT "avatar_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_role" "RoleCode",
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" VARCHAR(1000),
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_normalized_email_key" ON "users"("normalized_email");

-- CreateIndex
CREATE INDEX "users_created_at_id_idx" ON "users"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "users_account_status_created_at_id_idx" ON "users"("account_status", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "profiles_user_id_avatar_asset_id_idx" ON "profiles"("user_id", "avatar_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "user_roles_role_id_user_id_idx" ON "user_roles"("role_id", "user_id");

-- CreateIndex
CREATE INDEX "user_roles_assigned_by_idx" ON "user_roles"("assigned_by");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "otp_challenges_user_id_purpose_created_at_idx" ON "otp_challenges"("user_id", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "otp_issue_windows_window_start_idx" ON "otp_issue_windows"("window_start");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_revoked_at_absolute_expires_at_idx" ON "refresh_sessions"("user_id", "revoked_at", "absolute_expires_at");

-- CreateIndex
CREATE INDEX "refresh_sessions_absolute_expires_at_idx" ON "refresh_sessions"("absolute_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_user_id_id_key" ON "refresh_sessions"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_credentials_token_digest_key" ON "refresh_credentials"("token_digest");

-- CreateIndex
CREATE INDEX "refresh_credentials_expires_at_idx" ON "refresh_credentials"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_credentials_session_id_generation_key" ON "refresh_credentials"("session_id", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "reauth_proofs_digest_key" ON "reauth_proofs"("digest");

-- CreateIndex
CREATE INDEX "reauth_proofs_user_id_session_id_idx" ON "reauth_proofs"("user_id", "session_id");

-- CreateIndex
CREATE INDEX "reauth_proofs_expires_at_idx" ON "reauth_proofs"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "identity_email_deliveries_dedupe_key_key" ON "identity_email_deliveries"("dedupe_key");

-- CreateIndex
CREATE INDEX "identity_email_deliveries_status_next_attempt_at_idx" ON "identity_email_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "identity_email_deliveries_status_lease_until_idx" ON "identity_email_deliveries"("status", "lease_until");

-- CreateIndex
CREATE INDEX "identity_email_deliveries_expires_at_idx" ON "identity_email_deliveries"("expires_at");

-- CreateIndex
CREATE INDEX "identity_email_deliveries_user_id_idx" ON "identity_email_deliveries"("user_id");

-- CreateIndex
CREATE INDEX "identity_email_deliveries_challenge_id_idx" ON "identity_email_deliveries"("challenge_id");

-- CreateIndex
CREATE UNIQUE INDEX "avatar_assets_storage_key_key" ON "avatar_assets"("storage_key");

-- CreateIndex
CREATE INDEX "avatar_assets_state_expires_at_idx" ON "avatar_assets"("state", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "avatar_assets_user_id_id_key" ON "avatar_assets"("user_id", "id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_created_at_idx" ON "audit_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_id_idx" ON "audit_logs"("created_at", "id");

-- CreateIndex
CREATE INDEX "system_configurations_updated_by_user_id_idx" ON "system_configurations"("updated_by_user_id");

-- AddForeignKey
ALTER TABLE "system_configurations" ADD CONSTRAINT "system_configurations_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_avatar_asset_id_fkey" FOREIGN KEY ("user_id", "avatar_asset_id") REFERENCES "avatar_assets"("user_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_credentials" ADD CONSTRAINT "refresh_credentials_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "refresh_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reauth_proofs" ADD CONSTRAINT "reauth_proofs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reauth_proofs" ADD CONSTRAINT "reauth_proofs_user_id_session_id_fkey" FOREIGN KEY ("user_id", "session_id") REFERENCES "refresh_sessions"("user_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_email_deliveries" ADD CONSTRAINT "identity_email_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_email_deliveries" ADD CONSTRAINT "identity_email_deliveries_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "otp_challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_assets" ADD CONSTRAINT "avatar_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants not representable in the stable Prisma schema.
ALTER TABLE users ADD CONSTRAINT users_email_normalized CHECK
  (normalized_email = lower(btrim(normalized_email)) AND normalized_email !~ '\s' AND char_length(normalized_email) BETWEEN 5 AND 254);
ALTER TABLE users ADD CONSTRAINT users_counters CHECK (failed_login_count >= 0 AND security_version >= 0);
ALTER TABLE profiles ADD CONSTRAINT profiles_valid CHECK
  (char_length(full_name) BETWEEN 2 AND 100 AND verified_skill_count >= 0 AND completed_session_count >= 0 AND
   (reputation_score IS NULL OR reputation_score BETWEEN 0 AND 100));
ALTER TABLE otp_challenges ADD CONSTRAINT otp_valid CHECK
  (failed_attempts BETWEEN 0 AND 5 AND expires_at > created_at AND octet_length(verifier_digest) = 32 AND NOT (consumed_at IS NOT NULL AND superseded_at IS NOT NULL));
CREATE UNIQUE INDEX otp_outstanding ON otp_challenges(user_id, purpose) WHERE consumed_at IS NULL AND superseded_at IS NULL;
ALTER TABLE otp_issue_windows ADD CONSTRAINT otp_window_valid CHECK (issue_count >= 0 AND resend_count >= 0 AND resend_count <= issue_count);
ALTER TABLE refresh_sessions ADD CONSTRAINT sessions_valid CHECK
  (security_version >= 0 AND current_generation >= 0 AND absolute_expires_at > created_at AND
   ((revoked_at IS NULL AND revoked_reason IS NULL) OR (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL)));
ALTER TABLE refresh_credentials ADD CONSTRAINT credential_valid CHECK (generation >= 0 AND expires_at > created_at AND octet_length(token_digest) = 32);
ALTER TABLE reauth_proofs ADD CONSTRAINT reauth_valid CHECK (security_version >= 0 AND octet_length(digest) = 32);
ALTER TABLE avatar_assets ADD CONSTRAINT avatar_valid CHECK (byte_size BETWEEN 1 AND 5242880 AND mime IN ('image/jpeg', 'image/png', 'image/webp'));
ALTER TABLE identity_email_deliveries ADD CONSTRAINT delivery_valid CHECK
  (attempts >= 0 AND ((status = 'LEASED' AND lease_until IS NOT NULL) OR (status <> 'LEASED' AND lease_until IS NULL)) AND
   (status NOT IN ('SENT', 'FAILED', 'EXPIRED', 'CANCELLED') OR encrypted_payload IS NULL));
CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit records are append-only'; END;
$$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
