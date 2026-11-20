ALTER TABLE "reviews" ADD COLUMN "publication_state" TEXT;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderation_publication_state_check"
CHECK ("publication_state" IS NULL OR (
  "publication_state" IN ('PENDING', 'REJECTED') AND "hidden_at" IS NOT NULL
));
