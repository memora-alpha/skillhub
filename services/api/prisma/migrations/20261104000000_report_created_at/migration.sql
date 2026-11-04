-- Preserve unknown submission times on legacy reports. Only new reports receive now().
ALTER TABLE "report_cases" ADD COLUMN "created_at" TIMESTAMPTZ(3);
ALTER TABLE "report_cases" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
