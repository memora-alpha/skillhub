BEGIN;

ALTER TABLE "materials"
  ADD COLUMN "deleted_at" TIMESTAMPTZ(3),
  ADD COLUMN "legacy_archive_unclassified" BOOLEAN NOT NULL DEFAULT false;

-- Legacy archive and draft deletion both wrote ARCHIVED. Existing metadata
-- cannot distinguish them. Leave the deletion timestamp and history intact.
UPDATE "materials"
SET "legacy_archive_unclassified" = true
WHERE "status" = 'ARCHIVED';

ALTER TABLE "materials"
  ADD CONSTRAINT "materials_owner_lifecycle_check" CHECK (
    ("deleted_at" IS NULL OR "status" = 'ARCHIVED')
    AND (
      NOT "legacy_archive_unclassified"
      OR ("status" = 'ARCHIVED' AND "deleted_at" IS NULL)
    )
  );

COMMIT;
