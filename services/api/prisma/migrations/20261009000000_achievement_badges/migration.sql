ALTER TABLE "users"
ADD COLUMN "selected_title" VARCHAR(80);

CREATE TABLE "achievements" (
  "achievement_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "title" VARCHAR(80) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "criteria" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "achievements_pkey" PRIMARY KEY ("achievement_id")
);
CREATE UNIQUE INDEX "achievements_code_key" ON "achievements"("code");

CREATE TABLE "user_achievements" (
  "user_id" UUID NOT NULL,
  "achievement_id" UUID NOT NULL,
  "unlocked_at" TIMESTAMPTZ(3) NOT NULL,
  "source_snapshot" JSONB NOT NULL,
  CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("user_id", "achievement_id")
);
CREATE INDEX "user_achievements_achievement_id_unlocked_at_idx"
ON "user_achievements"("achievement_id", "unlocked_at");
ALTER TABLE "user_achievements"
ADD CONSTRAINT "user_achievements_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "user_achievements"
ADD CONSTRAINT "user_achievements_achievement_id_fkey"
FOREIGN KEY ("achievement_id") REFERENCES "achievements"("achievement_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
