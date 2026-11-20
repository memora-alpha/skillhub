CREATE TABLE "report_content_moderation" (
    "kind" VARCHAR(24) NOT NULL,
    "source_id" VARCHAR(64) NOT NULL,
    "case_id" UUID,
    "source_version" VARCHAR(64) NOT NULL,
    "digest" CHAR(64) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "reason_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "policy_version" VARCHAR(80),
    "classifier_version" VARCHAR(128),
    "assessment_id" VARCHAR(200),

    CONSTRAINT "report_content_moderation_pkey" PRIMARY KEY ("kind", "source_id"),
    CONSTRAINT "report_content_moderation_case_id_fkey"
        FOREIGN KEY ("case_id") REFERENCES "report_cases"("case_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "report_content_moderation_kind_check"
        CHECK ("kind" IN ('CASE_REPORT', 'CASE_MESSAGE', 'CASE_EVIDENCE', 'MATERIAL_REVIEW_REPORT')),
    CONSTRAINT "report_content_moderation_case_check"
        CHECK (("case_id" IS NULL) = ("kind" = 'MATERIAL_REVIEW_REPORT')),
    CONSTRAINT "report_content_moderation_status_check"
        CHECK ("status" IN ('PENDING', 'ALLOW', 'BLOCK', 'REVIEW', 'RETRY', 'SUPERSEDED'))
);

CREATE INDEX "report_content_moderation_case_status_idx"
    ON "report_content_moderation" ("case_id", "status");
