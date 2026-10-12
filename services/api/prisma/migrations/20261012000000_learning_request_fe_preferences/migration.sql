-- Additive FE extension; preserve existing requests and legacy absolute slots.
ALTER TABLE "learning_requests"
  ADD COLUMN "teaching_overview" VARCHAR(3000),
  ADD COLUMN "preferred_availability" JSONB,
  ADD COLUMN "desired_credit_per_hour" BIGINT,
  ADD CONSTRAINT "learning_requests_teaching_overview_check"
    CHECK ("teaching_overview" IS NULL OR char_length("teaching_overview") BETWEEN 20 AND 3000),
  ADD CONSTRAINT "learning_requests_hourly_credit_check"
    CHECK ("desired_credit_per_hour" IS NULL OR "desired_credit_per_hour" BETWEEN 1 AND 999999999999),
  ADD CONSTRAINT "learning_requests_availability_check"
    CHECK ("preferred_availability" IS NULL OR (
      jsonb_typeof("preferred_availability") = 'object'
      AND "preferred_availability" ? 'timeZone'
      AND "preferred_availability" ? 'weeklySlots'
      AND jsonb_typeof("preferred_availability"->'timeZone') = 'string'
      AND jsonb_typeof("preferred_availability"->'weeklySlots') = 'array'
      AND jsonb_array_length("preferred_availability"->'weeklySlots') <= 5
      AND (jsonb_array_length("preferred_availability"->'weeklySlots') = 0 OR jsonb_array_length("preferred_slots") = 0)
    ));

CREATE TABLE "learning_request_offerings" (
  "request_id" UUID NOT NULL,
  "sharing_skill_id" UUID NOT NULL,
  CONSTRAINT "learning_request_offerings_pkey" PRIMARY KEY ("request_id", "sharing_skill_id"),
  CONSTRAINT "learning_request_offerings_request_fkey" FOREIGN KEY ("request_id") REFERENCES "learning_requests"("request_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "learning_request_offerings_sharing_fkey" FOREIGN KEY ("sharing_skill_id") REFERENCES "sharing_skills"("sharing_skill_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "learning_request_offerings_sharing_idx" ON "learning_request_offerings"("sharing_skill_id", "request_id");
