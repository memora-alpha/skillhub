CREATE TABLE "material_download_grants" (
  "grant_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "requested_by" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "issued_at" TIMESTAMPTZ(3),
  "failed_at" TIMESTAMPTZ(3),
  "failure_code" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "material_download_grants_pkey" PRIMARY KEY ("grant_id"),
  CONSTRAINT "material_download_grants_status_check"
    CHECK ("status" IN ('PENDING', 'ISSUED', 'FAILED', 'EXPIRED')),
  CONSTRAINT "material_download_grants_state_check" CHECK (
    ("status" = 'PENDING' AND "issued_at" IS NULL AND "failed_at" IS NULL AND "failure_code" IS NULL)
    OR ("status" = 'ISSUED' AND "issued_at" IS NOT NULL AND "failed_at" IS NULL AND "failure_code" IS NULL)
    OR ("status" = 'FAILED' AND "issued_at" IS NULL AND "failed_at" IS NOT NULL)
    OR ("status" = 'EXPIRED' AND "issued_at" IS NULL AND "failed_at" IS NULL AND "failure_code" IS NULL)
  ),
  CONSTRAINT "material_download_grants_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "material_orders"("order_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "material_download_grants_requested_by_fkey"
    FOREIGN KEY ("requested_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE INDEX "material_download_grants_order_status_expiry_idx"
  ON "material_download_grants"("order_id", "status", "expires_at");
CREATE INDEX "material_download_grants_status_expiry_idx"
  ON "material_download_grants"("status", "expires_at");
CREATE INDEX "material_download_grants_requested_by_idx"
  ON "material_download_grants"("requested_by");
