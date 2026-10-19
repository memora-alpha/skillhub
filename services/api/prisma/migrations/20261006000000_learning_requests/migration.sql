CREATE TYPE "CatalogStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "LearningLevel" AS ENUM ('NONE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED');
CREATE TYPE "LearningRequestStatus" AS ENUM (
    'DRAFT', 'PENDING_MODERATION', 'OPEN', 'REJECTED', 'NEGOTIATING',
    'MATCHED', 'CLOSED', 'CANCELLED', 'EXPIRED'
);
CREATE TYPE "RequestModerationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "RequestExpiryMode" AS ENUM ('DEFAULT', 'CUSTOM');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

CREATE TABLE "skill_categories" (
    "category_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "status" "CatalogStatus" NOT NULL,
    "parent_category_id" UUID,
    CONSTRAINT "skill_categories_pkey" PRIMARY KEY ("category_id"),
    CONSTRAINT "skill_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id")
        REFERENCES "skill_categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "skill_categories_name_key" ON "skill_categories"("name");
CREATE UNIQUE INDEX "skill_categories_slug_key" ON "skill_categories"("slug");
CREATE INDEX "skill_categories_parent_category_id_idx" ON "skill_categories"("parent_category_id");

CREATE TABLE "skills" (
    "skill_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "category_id" UUID,
    "description" VARCHAR(500),
    "status" "CatalogStatus" NOT NULL,
    CONSTRAINT "skills_pkey" PRIMARY KEY ("skill_id"),
    CONSTRAINT "skills_category_id_fkey" FOREIGN KEY ("category_id")
        REFERENCES "skill_categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");
CREATE UNIQUE INDEX "skills_slug_key" ON "skills"("slug");
CREATE INDEX "skills_category_id_idx" ON "skills"("category_id");

CREATE TABLE "tags" (
    "tag_id" UUID NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "status" "CatalogStatus" NOT NULL,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("tag_id")
);
CREATE UNIQUE INDEX "tags_label_key" ON "tags"("label");

CREATE TABLE "learning_requests" (
    "request_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "learning_goal" VARCHAR(1000) NOT NULL,
    "preferred_slots" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "current_level" "LearningLevel",
    "verified_teacher_only" BOOLEAN NOT NULL DEFAULT false,
    "status" "LearningRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "moderation_status" "RequestModerationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "reject_reason" VARCHAR(500),
    "flagged_rules" JSONB,
    "moderation_rule_set_version" INTEGER,
    "moderation_reviewed_version" INTEGER,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "requested_expires_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "expiry_mode" "RequestExpiryMode" NOT NULL DEFAULT 'DEFAULT',
    "published_at" TIMESTAMPTZ(3),
    "content_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "learning_requests_pkey" PRIMARY KEY ("request_id"),
    CONSTRAINT "learning_requests_owner_id_fkey" FOREIGN KEY ("owner_id")
        REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "learning_requests_skill_id_fkey" FOREIGN KEY ("skill_id")
        REFERENCES "skills"("skill_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "learning_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id")
        REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "learning_requests_title_check" CHECK (char_length("title") BETWEEN 10 AND 120),
    CONSTRAINT "learning_requests_description_check" CHECK (char_length("description") BETWEEN 20 AND 3000),
    CONSTRAINT "learning_requests_goal_check" CHECK (char_length("learning_goal") BETWEEN 10 AND 1000),
    CONSTRAINT "learning_requests_version_check" CHECK ("content_version" > 0),
    CONSTRAINT "learning_requests_preferred_slots_check" CHECK (
        jsonb_typeof("preferred_slots") = 'array' AND
        CASE WHEN jsonb_typeof("preferred_slots") = 'array'
            THEN jsonb_array_length("preferred_slots") <= 5 ELSE false END
    ),
    CONSTRAINT "learning_requests_flagged_rules_check" CHECK (
        "flagged_rules" IS NULL OR jsonb_typeof("flagged_rules") = 'array'
    ),
    CONSTRAINT "learning_requests_requested_expiry_mode_check" CHECK (
        ("expiry_mode" = 'DEFAULT' AND "requested_expires_at" IS NULL) OR
        ("expiry_mode" = 'CUSTOM' AND "requested_expires_at" IS NOT NULL)
    ),
    CONSTRAINT "learning_requests_published_expiry_check" CHECK (
        "published_at" IS NULL OR
        ("expiry_mode" = 'DEFAULT' AND "requested_expires_at" IS NULL) OR
        ("expiry_mode" = 'CUSTOM' AND "requested_expires_at" = "expires_at")
    ),
    CONSTRAINT "learning_requests_moderation_versions_check" CHECK (
        ("moderation_rule_set_version" IS NULL OR "moderation_rule_set_version" > 0) AND
        ("moderation_reviewed_version" IS NULL OR "moderation_reviewed_version" > 0)
    ),
    CONSTRAINT "learning_requests_publish_deadline_check" CHECK (
        ("published_at" IS NULL) = ("expires_at" IS NULL)
    ),
    CONSTRAINT "learning_requests_moderation_consistency_check" CHECK (
        ("status" <> 'DRAFT' OR "moderation_status" = 'NOT_REQUIRED') AND
        ("status" <> 'PENDING_MODERATION' OR "moderation_status" = 'PENDING') AND
        ("status" <> 'OPEN' OR "moderation_status" IN ('NOT_REQUIRED', 'APPROVED')) AND
        ("status" <> 'REJECTED' OR (
            "moderation_status" = 'REJECTED' AND
            "reject_reason" IS NOT NULL AND
            char_length("reject_reason") BETWEEN 10 AND 500
        ))
    )
);
CREATE INDEX "learning_requests_owner_id_created_at_request_id_idx"
    ON "learning_requests"("owner_id", "created_at" DESC, "request_id" DESC);
CREATE INDEX "learning_requests_skill_id_status_created_at_request_id_idx"
    ON "learning_requests"("skill_id", "status", "created_at" DESC, "request_id" DESC);
CREATE INDEX "learning_requests_status_created_at_request_id_idx"
    ON "learning_requests"("status", "created_at" DESC, "request_id" DESC);
CREATE INDEX "learning_requests_expiry_due_idx"
    ON "learning_requests"("expires_at", "request_id")
    WHERE "status" IN ('OPEN', 'PENDING_MODERATION') AND "expires_at" IS NOT NULL;

CREATE TABLE "learning_request_tags" (
    "request_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    CONSTRAINT "learning_request_tags_pkey" PRIMARY KEY ("request_id", "tag_id"),
    CONSTRAINT "learning_request_tags_request_id_fkey" FOREIGN KEY ("request_id")
        REFERENCES "learning_requests"("request_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "learning_request_tags_tag_id_fkey" FOREIGN KEY ("tag_id")
        REFERENCES "tags"("tag_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "learning_request_tags_tag_id_request_id_idx"
    ON "learning_request_tags"("tag_id", "request_id");

CREATE TABLE "notifications" (
    "notification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "channel" "NotificationChannel" NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id"),
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "notifications_user_id_created_at_notification_id_idx"
    ON "notifications"("user_id", "created_at" DESC, "notification_id" DESC);
