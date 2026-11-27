-- Subscriptions (spec 021): Credit-paid plans, charges, usage and retention snapshots.
-- CreateEnum
CREATE TYPE "SubscriptionPlanCode" AS ENUM ('CREATOR', 'PRO');

-- CreateEnum
CREATE TYPE "SubscriptionInterval" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "SubscriptionPlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'GRACE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionChargeKind" AS ENUM ('PURCHASE', 'RENEWAL', 'UPGRADE', 'RECORDING_ADDON');

-- AlterEnum
ALTER TYPE "CreditTransactionType" ADD VALUE 'SUBSCRIPTION_PURCHASE';

-- AlterEnum
ALTER TYPE "CreditReferenceType" ADD VALUE 'SUBSCRIPTION_CHARGE';

-- AlterTable
ALTER TABLE "session_whiteboards" ADD COLUMN     "retention_days" INTEGER;

-- AlterTable
ALTER TABLE "session_recordings" ADD COLUMN     "charged_minutes" INTEGER,
ADD COLUMN     "retention_days" INTEGER,
ADD COLUMN     "subscription_id" UUID;

-- CreateTable
CREATE TABLE "subscription_plan_versions" (
    "id" UUID NOT NULL,
    "plan_code" "SubscriptionPlanCode" NOT NULL,
    "version_no" INTEGER NOT NULL,
    "month_price" BIGINT NOT NULL,
    "year_price" BIGINT NOT NULL,
    "entitlements" JSONB NOT NULL,
    "status" "SubscriptionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_at" TIMESTAMPTZ(3),
    "approved_at" TIMESTAMPTZ(3),
    "approved_by_user_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscription_plan_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_code" "SubscriptionPlanCode" NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "interval" "SubscriptionInterval" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "term_start" TIMESTAMPTZ(3) NOT NULL,
    "term_end" TIMESTAMPTZ(3) NOT NULL,
    "grace_until" TIMESTAMPTZ(3),
    "next_renewal_attempt_at" TIMESTAMPTZ(3),
    "scheduled_plan_code" "SubscriptionPlanCode",
    "scheduled_interval" "SubscriptionInterval",
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_charges" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "SubscriptionChargeKind" NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "operation_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "request_digest" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_usage" (
    "subscription_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ(3) NOT NULL,
    "recording_minutes_allowed" INTEGER NOT NULL,
    "recording_minutes_used" INTEGER NOT NULL DEFAULT 0,
    "addon_minutes_remaining" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscription_usage_pkey" PRIMARY KEY ("subscription_id","period_start")
);

-- CreateIndex
CREATE INDEX "subscription_plan_versions_plan_code_status_effective_at_idx" ON "subscription_plan_versions"("plan_code", "status", "effective_at");

-- CreateIndex
CREATE INDEX "subscription_plan_versions_approved_by_user_id_idx" ON "subscription_plan_versions"("approved_by_user_id");

-- CreateIndex
CREATE INDEX "subscription_plan_versions_created_by_user_id_idx" ON "subscription_plan_versions"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plan_versions_plan_code_version_no_key" ON "subscription_plan_versions"("plan_code", "version_no");

-- CreateIndex
CREATE INDEX "user_subscriptions_status_next_renewal_attempt_at_idx" ON "user_subscriptions"("status", "next_renewal_attempt_at");

-- CreateIndex
CREATE INDEX "user_subscriptions_user_id_created_at_idx" ON "user_subscriptions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_subscriptions_plan_version_id_idx" ON "user_subscriptions"("plan_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_charges_operation_id_key" ON "subscription_charges"("operation_id");

-- CreateIndex
CREATE INDEX "subscription_charges_user_id_created_at_id_idx" ON "subscription_charges"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "subscription_charges_subscription_id_idx" ON "subscription_charges"("subscription_id");

-- CreateIndex
CREATE INDEX "subscription_charges_plan_version_id_idx" ON "subscription_charges"("plan_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_charges_user_id_idempotency_key_key" ON "subscription_charges"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "session_recordings_subscription_id_idx" ON "session_recordings"("subscription_id");

-- AddForeignKey
ALTER TABLE "session_recordings" ADD CONSTRAINT "session_recordings_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "user_subscriptions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "subscription_plan_versions" ADD CONSTRAINT "subscription_plan_versions_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "subscription_plan_versions" ADD CONSTRAINT "subscription_plan_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "subscription_plan_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "user_subscriptions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "subscription_plan_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "credit_operations"("operation_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "subscription_usage" ADD CONSTRAINT "subscription_usage_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "user_subscriptions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Plan versions: positive prices; an approved version records when and by whom.
ALTER TABLE "subscription_plan_versions" ADD CONSTRAINT "subscription_plan_versions_price_check" CHECK ("month_price" > 0 AND "year_price" > 0);
ALTER TABLE "subscription_plan_versions" ADD CONSTRAINT "subscription_plan_versions_version_no_check" CHECK ("version_no" >= 1);
ALTER TABLE "subscription_plan_versions" ADD CONSTRAINT "subscription_plan_versions_approved_check" CHECK ("status" = 'DRAFT' OR ("effective_at" IS NOT NULL AND "approved_at" IS NOT NULL AND "approved_by_user_id" IS NOT NULL));
ALTER TABLE "subscription_plan_versions" ADD CONSTRAINT "subscription_plan_versions_entitlements_check" CHECK (jsonb_typeof("entitlements") = 'object');

-- Subscriptions: a valid term; grace and expiry record their times.
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_term_check" CHECK ("term_end" > "term_start");
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_grace_check" CHECK ("status" <> 'GRACE' OR "grace_until" IS NOT NULL);
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_expired_check" CHECK (("status" = 'EXPIRED') = ("ended_at" IS NOT NULL));
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_version_check" CHECK ("version" >= 1);

-- One ACTIVE or GRACE subscription per user (not expressible in the Prisma schema).
CREATE UNIQUE INDEX "user_subscriptions_one_current_per_user" ON "user_subscriptions"("user_id") WHERE "status" IN ('ACTIVE', 'GRACE');

-- Charges: positive amounts; only add-on charges carry a quantity above one.
ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_amount_check" CHECK ("amount" > 0);
ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_quantity_check" CHECK ("quantity" >= 1 AND ("kind" = 'RECORDING_ADDON' OR "quantity" = 1));
-- Both digests are SHA-256 hex, always 64 characters.
ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_digest_length_check" CHECK (char_length("idempotency_key") = 64 AND char_length("request_digest") = 64);

ALTER TABLE "subscription_usage" ADD CONSTRAINT "subscription_usage_minutes_check" CHECK ("recording_minutes_allowed" >= 0 AND "recording_minutes_used" >= 0 AND "addon_minutes_remaining" >= 0);

-- Retention snapshots use the same ranges as the global configuration keys.
ALTER TABLE "session_whiteboards" ADD CONSTRAINT "session_whiteboards_retention_days_check" CHECK ("retention_days" IS NULL OR "retention_days" BETWEEN 8 AND 3650);
ALTER TABLE "session_recordings" ADD CONSTRAINT "session_recordings_retention_days_check" CHECK ("retention_days" IS NULL OR "retention_days" BETWEEN 1 AND 3650);
-- Minutes are charged only to a subscription.
ALTER TABLE "session_recordings" ADD CONSTRAINT "session_recordings_charged_minutes_check" CHECK ("charged_minutes" IS NULL OR ("charged_minutes" >= 0 AND "subscription_id" IS NOT NULL));
