-- CreateEnum
CREATE TYPE "VoucherRedemptionStatus" AS ENUM ('ISSUING', 'ISSUED', 'FAILED_REFUNDED', 'MANUAL_REVIEW', 'REFUNDED_MANUAL');

-- CreateEnum
CREATE TYPE "RewardItemStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'REMOVED');

-- AlterEnum
ALTER TYPE "CreditTransactionType" ADD VALUE 'VOUCHER_REDEMPTION';

-- AlterEnum
ALTER TYPE "CreditReferenceType" ADD VALUE 'VOUCHER_REDEMPTION';

-- CreateTable
CREATE TABLE "reward_brands" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "provider_brand_id" VARCHAR(100) NOT NULL,
    "name_vi" VARCHAR(150) NOT NULL,
    "name_en" VARCHAR(150),
    "logo_url" TEXT,
    "status" "RewardItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "synced_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_products" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "provider_product_id" VARCHAR(100) NOT NULL,
    "brand_id" UUID NOT NULL,
    "category" VARCHAR(100),
    "name_vi" VARCHAR(200) NOT NULL,
    "name_en" VARCHAR(200),
    "image_url" TEXT,
    "face_value_vnd" BIGINT NOT NULL,
    "terms_vi" TEXT,
    "terms_en" TEXT,
    "validity_days" INTEGER,
    "price_credit" BIGINT,
    "price_version" INTEGER NOT NULL DEFAULT 1,
    "status" "RewardItemStatus" NOT NULL DEFAULT 'INACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "display_name_override" VARCHAR(200),
    "image_override" TEXT,
    "raw_payload" JSONB,
    "synced_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reward_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_redemptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "price_credit" BIGINT NOT NULL,
    "price_version" INTEGER NOT NULL,
    "face_value_vnd" BIGINT NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "status" "VoucherRedemptionStatus" NOT NULL DEFAULT 'ISSUING',
    "idempotency_key" VARCHAR(255) NOT NULL,
    "debit_operation_id" UUID NOT NULL,
    "refund_operation_id" UUID,
    "provider_transaction_ref" VARCHAR(255),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" VARCHAR(100),
    "next_check_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "voucher_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issued_vouchers" (
    "redemption_id" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "secret_ciphertext" BYTEA NOT NULL,
    "secret_iv" BYTEA NOT NULL,
    "secret_tag" BYTEA NOT NULL,
    "key_version" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issued_vouchers_pkey" PRIMARY KEY ("redemption_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reward_brands_provider_provider_brand_id_key" ON "reward_brands"("provider", "provider_brand_id");

-- CreateIndex
CREATE INDEX "reward_products_catalog_idx" ON "reward_products"("status", "sort_order", "id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_products_provider_provider_product_id_key" ON "reward_products"("provider", "provider_product_id");

-- CreateIndex
CREATE INDEX "voucher_redemptions_user_page_idx" ON "voucher_redemptions"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "voucher_redemptions_reconcile_idx" ON "voucher_redemptions"("status", "next_check_at");

-- CreateIndex
CREATE INDEX "voucher_redemptions_budget_idx" ON "voucher_redemptions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_redemptions_user_id_idempotency_key_key" ON "voucher_redemptions"("user_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_redemptions_debit_operation_id_key" ON "voucher_redemptions"("debit_operation_id");

-- AddForeignKey
ALTER TABLE "reward_products" ADD CONSTRAINT "reward_products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "reward_brands"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "reward_products"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_debit_operation_id_fkey" FOREIGN KEY ("debit_operation_id") REFERENCES "credit_operations"("operation_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_refund_operation_id_fkey" FOREIGN KEY ("refund_operation_id") REFERENCES "credit_operations"("operation_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "issued_vouchers" ADD CONSTRAINT "issued_vouchers_redemption_id_fkey" FOREIGN KEY ("redemption_id") REFERENCES "voucher_redemptions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Spec 018 invariants.
ALTER TABLE "reward_products"
  ADD CONSTRAINT "reward_products_face_value_positive" CHECK ("face_value_vnd" > 0),
  ADD CONSTRAINT "reward_products_price_positive" CHECK ("price_credit" IS NULL OR "price_credit" > 0),
  ADD CONSTRAINT "reward_products_active_priced" CHECK ("status" <> 'ACTIVE' OR "price_credit" IS NOT NULL);

ALTER TABLE "voucher_redemptions"
  ADD CONSTRAINT "voucher_redemptions_price_positive" CHECK ("price_credit" > 0),
  ADD CONSTRAINT "voucher_redemptions_attempts_nonnegative" CHECK ("attempts" >= 0);
