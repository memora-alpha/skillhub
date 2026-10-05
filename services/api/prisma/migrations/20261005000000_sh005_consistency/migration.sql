CREATE TABLE "idempotency_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scope" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "key_digest" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "result_reference" JSONB,
  "completed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "idempotency_records_scope_operation_key_digest_key" UNIQUE ("scope", "operation", "key_digest"),
  CONSTRAINT "idempotency_records_completion_check" CHECK (("result_reference" IS NULL) = ("completed_at" IS NULL))
);

CREATE TABLE "outbox_events" (
  "event_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "correlation_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_token" UUID,
  "lease_until" TIMESTAMPTZ(3),
  "delivered_at" TIMESTAMPTZ(3),
  "total_attempts" INTEGER NOT NULL DEFAULT 0,
  "cycle_attempts" INTEGER NOT NULL DEFAULT 0,
  "replay_count" INTEGER NOT NULL DEFAULT 0,
  "failed_at" TIMESTAMPTZ(3),
  "last_error_code" TEXT,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("event_id"),
  CONSTRAINT "outbox_events_version_check" CHECK ("version" > 0),
  CONSTRAINT "outbox_events_attempts_check" CHECK ("total_attempts" >= 0 AND "cycle_attempts" >= 0 AND "replay_count" >= 0)
);

CREATE INDEX "outbox_events_available_at_created_at_idx" ON "outbox_events"("available_at", "created_at");
CREATE INDEX "outbox_events_pending_idx" ON "outbox_events"("available_at", "created_at") WHERE "delivered_at" IS NULL AND "failed_at" IS NULL;

CREATE TABLE "outbox_consumer_receipts" (
  "consumer" TEXT NOT NULL,
  "event_id" UUID NOT NULL,
  "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "outbox_consumer_receipts_pkey" PRIMARY KEY ("consumer", "event_id")
);
