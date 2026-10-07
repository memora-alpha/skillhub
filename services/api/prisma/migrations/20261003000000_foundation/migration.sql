CREATE TABLE "system_configurations" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "effective_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "system_configurations_pkey" PRIMARY KEY ("key")
);
