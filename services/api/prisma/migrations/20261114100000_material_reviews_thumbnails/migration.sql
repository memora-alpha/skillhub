-- Extend durable download grants so FREE access is also recorded server-side.
ALTER TABLE "material_download_grants"
  ADD COLUMN "material_id" UUID,
  ADD COLUMN "access_source" TEXT;

UPDATE "material_download_grants" AS grant
SET "material_id" = orders."material_id",
    "access_source" = 'PAID_ENTITLEMENT'
FROM "material_orders" AS orders
WHERE orders."order_id" = grant."order_id";

ALTER TABLE "material_download_grants"
  ALTER COLUMN "material_id" SET NOT NULL,
  ALTER COLUMN "access_source" SET NOT NULL,
  ALTER COLUMN "order_id" DROP NOT NULL,
  ADD CONSTRAINT "material_download_grants_material_id_fkey"
    FOREIGN KEY ("material_id") REFERENCES "materials"("material_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "material_download_grants_access_source_check"
    CHECK (
      ("access_source" = 'FREE_PUBLIC' AND "order_id" IS NULL)
      OR ("access_source" = 'PAID_ENTITLEMENT' AND "order_id" IS NOT NULL)
    );

CREATE INDEX "material_download_grants_material_requester_status_idx"
  ON "material_download_grants"("material_id", "requested_by", "status");

ALTER TABLE "materials"
  ADD COLUMN "cover_file_id" UUID,
  ADD COLUMN "cover_generation" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "materials_cover_generation_check" CHECK ("cover_generation" >= 0),
  ADD CONSTRAINT "materials_cover_file_id_fkey"
    FOREIGN KEY ("cover_file_id") REFERENCES "stored_files"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "materials_cover_file_id_key"
  ON "materials"("cover_file_id") WHERE "cover_file_id" IS NOT NULL;

CREATE TABLE "material_reviews" (
  "review_id" UUID NOT NULL,
  "material_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "rating" SMALLINT NOT NULL,
  "comment" VARCHAR(2000),
  "status" TEXT NOT NULL,
  "eligibility_source" TEXT NOT NULL,
  "source_order_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "material_reviews_pkey" PRIMARY KEY ("review_id"),
  CONSTRAINT "material_reviews_material_id_fkey" FOREIGN KEY ("material_id")
    REFERENCES "materials"("material_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "material_reviews_author_id_fkey" FOREIGN KEY ("author_id")
    REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "material_reviews_source_order_id_fkey" FOREIGN KEY ("source_order_id")
    REFERENCES "material_orders"("order_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "material_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "material_reviews_status_check" CHECK ("status" IN ('VISIBLE', 'HIDDEN')),
  CONSTRAINT "material_reviews_eligibility_check" CHECK (
    ("eligibility_source" = 'FREE_ACCESS' AND "source_order_id" IS NULL)
    OR ("eligibility_source" = 'PAID_ENTITLEMENT' AND "source_order_id" IS NOT NULL)
  ),
  CONSTRAINT "material_reviews_version_check" CHECK ("version" > 0),
  CONSTRAINT "material_reviews_comment_check" CHECK (
    "comment" IS NULL OR (char_length("comment") BETWEEN 1 AND 2000 AND "comment" = btrim("comment"))
  )
);

CREATE UNIQUE INDEX "material_reviews_active_author_key"
  ON "material_reviews"("material_id", "author_id")
  WHERE "deleted_at" IS NULL;
CREATE INDEX "material_reviews_public_page_idx"
  ON "material_reviews"("material_id", "status", "created_at" DESC, "review_id" DESC)
  WHERE "deleted_at" IS NULL;
CREATE INDEX "material_reviews_author_idx"
  ON "material_reviews"("author_id", "created_at" DESC);

CREATE TABLE "material_rating_summaries" (
  "material_id" UUID NOT NULL,
  "visible_count" INTEGER NOT NULL DEFAULT 0,
  "star_1" INTEGER NOT NULL DEFAULT 0,
  "star_2" INTEGER NOT NULL DEFAULT 0,
  "star_3" INTEGER NOT NULL DEFAULT 0,
  "star_4" INTEGER NOT NULL DEFAULT 0,
  "star_5" INTEGER NOT NULL DEFAULT 0,
  "rating_sum" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "material_rating_summaries_pkey" PRIMARY KEY ("material_id"),
  CONSTRAINT "material_rating_summaries_material_id_fkey" FOREIGN KEY ("material_id")
    REFERENCES "materials"("material_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "material_rating_summaries_counts_check" CHECK (
    "visible_count" >= 0 AND "star_1" >= 0 AND "star_2" >= 0 AND
    "star_3" >= 0 AND "star_4" >= 0 AND "star_5" >= 0 AND
    "rating_sum" >= 0 AND
    "visible_count" = "star_1" + "star_2" + "star_3" + "star_4" + "star_5" AND
    "rating_sum" = "star_1" + 2 * "star_2" + 3 * "star_3" + 4 * "star_4" + 5 * "star_5"
  )
);

INSERT INTO "material_rating_summaries" ("material_id")
SELECT "material_id" FROM "materials"
ON CONFLICT DO NOTHING;

CREATE TABLE "material_review_reports" (
  "report_id" UUID NOT NULL,
  "review_id" UUID NOT NULL,
  "reporter_id" UUID NOT NULL,
  "reason_code" VARCHAR(80) NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "status" TEXT NOT NULL,
  "resolved_by_id" UUID,
  "decision_reason" VARCHAR(2000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(3),
  CONSTRAINT "material_review_reports_pkey" PRIMARY KEY ("report_id"),
  CONSTRAINT "material_review_reports_review_id_fkey" FOREIGN KEY ("review_id")
    REFERENCES "material_reviews"("review_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "material_review_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id")
    REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "material_review_reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id")
    REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "material_review_reports_status_check" CHECK ("status" IN ('OPEN', 'RESOLVED')),
  CONSTRAINT "material_review_reports_description_check" CHECK (
    char_length("description") BETWEEN 10 AND 2000 AND "description" = btrim("description")
  )
);

CREATE UNIQUE INDEX "material_review_reports_active_reporter_key"
  ON "material_review_reports"("review_id", "reporter_id") WHERE "status" = 'OPEN';
CREATE INDEX "material_review_reports_review_status_idx"
  ON "material_review_reports"("review_id", "status", "created_at" DESC);
CREATE INDEX "material_review_reports_queue_idx"
  ON "material_review_reports"("status", "created_at" DESC, "report_id" DESC);
CREATE INDEX "material_review_reports_reporter_idx"
  ON "material_review_reports"("reporter_id", "created_at" DESC);

CREATE TABLE "material_thumbnails" (
  "thumbnail_id" UUID NOT NULL,
  "material_id" UUID NOT NULL,
  "source_file_id" UUID NOT NULL,
  "source_generation" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "small_object_key" TEXT,
  "large_object_key" TEXT,
  "small_size_bytes" INTEGER,
  "large_size_bytes" INTEGER,
  "small_checksum" CHAR(64),
  "large_checksum" CHAR(64),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "failure_code" VARCHAR(100),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "material_thumbnails_pkey" PRIMARY KEY ("thumbnail_id"),
  CONSTRAINT "material_thumbnails_material_id_fkey" FOREIGN KEY ("material_id")
    REFERENCES "materials"("material_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "material_thumbnails_source_file_id_fkey" FOREIGN KEY ("source_file_id")
    REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "material_thumbnails_status_check" CHECK ("status" IN ('PENDING', 'READY', 'FAILED', 'SUPERSEDED')),
  CONSTRAINT "material_thumbnails_generation_check" CHECK ("source_generation" > 0),
  CONSTRAINT "material_thumbnails_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "material_thumbnails_ready_check" CHECK (
    ("status" = 'READY' AND "small_object_key" IS NOT NULL AND "large_object_key" IS NOT NULL AND
      "small_size_bytes" IS NOT NULL AND "large_size_bytes" IS NOT NULL AND
      "small_checksum" IS NOT NULL AND "large_checksum" IS NOT NULL)
    OR "status" <> 'READY'
  )
);

CREATE UNIQUE INDEX "material_thumbnails_material_generation_key"
  ON "material_thumbnails"("material_id", "source_generation");
CREATE INDEX "material_thumbnails_current_idx"
  ON "material_thumbnails"("material_id", "status", "source_generation" DESC);
CREATE INDEX "material_thumbnails_status_idx"
  ON "material_thumbnails"("status", "updated_at");
