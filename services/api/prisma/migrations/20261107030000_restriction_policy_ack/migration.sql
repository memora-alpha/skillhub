ALTER TABLE "user_restrictions"
  ADD COLUMN "policy_required" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "policy_acknowledged_at" TIMESTAMPTZ(3);
