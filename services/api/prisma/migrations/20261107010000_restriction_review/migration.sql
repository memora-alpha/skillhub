ALTER TABLE "user_restrictions"
  ADD COLUMN "review_decision" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMPTZ(3),
  ADD CONSTRAINT "user_restrictions_review_decision_check" CHECK (
    ("review_decision" IS NULL AND "reviewed_at" IS NULL)
    OR ("review_decision" IS NOT NULL AND "review_decision" IN ('APPROVED', 'FOLLOW_UP_REQUIRED') AND "reviewed_at" IS NOT NULL)
  );
