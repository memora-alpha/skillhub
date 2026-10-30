CREATE TABLE "verification_ai_analyses" (
  "id" UUID PRIMARY KEY,
  "verification_id" UUID NOT NULL REFERENCES "skill_verifications"("verification_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "status" VARCHAR(20) NOT NULL,
  "input_hash" CHAR(64) NOT NULL,
  "input" JSONB NOT NULL,
  "result" JSONB,
  "model" VARCHAR(128) NOT NULL,
  "prompt_version" VARCHAR(40) NOT NULL,
  "requested_by_user_id" UUID REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lease_token" UUID,
  "lease_until" TIMESTAMPTZ(3),
  "error_code" VARCHAR(80),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(3),
  CONSTRAINT "verification_ai_status_check" CHECK ("status" IN ('QUEUED','PROCESSING','SUCCEEDED','FAILED','STALE','UNSUPPORTED')),
  CONSTRAINT "verification_ai_attempts_check" CHECK ("attempts" BETWEEN 0 AND 3),
  CONSTRAINT "verification_ai_hash_check" CHECK ("input_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "verification_ai_lease_check" CHECK (
    ("status" = 'PROCESSING' AND "lease_token" IS NOT NULL AND "lease_until" IS NOT NULL) OR
    ("status" <> 'PROCESSING' AND "lease_token" IS NULL AND "lease_until" IS NULL)
  )
);
CREATE INDEX "verification_ai_history_idx" ON "verification_ai_analyses" ("verification_id", "created_at" DESC, "id" DESC);
CREATE INDEX "verification_ai_recovery_idx" ON "verification_ai_analyses" ("status", "lease_until");
CREATE UNIQUE INDEX "verification_ai_active_unique" ON "verification_ai_analyses" ("verification_id") WHERE "status" IN ('QUEUED','PROCESSING');
