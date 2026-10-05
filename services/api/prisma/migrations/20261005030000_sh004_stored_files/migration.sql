CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "original_name" TEXT NOT NULL,
    "detected_mime" TEXT,
    "size_bytes" INTEGER,
    "sha256" TEXT,
    "state" TEXT NOT NULL,
    "scan_attempts" INTEGER NOT NULL DEFAULT 0,
    "scan_verdict" TEXT,
    "scanner_version" TEXT,
    "scanned_at" TIMESTAMPTZ(3),
    "scan_lease_token" UUID,
    "scan_lease_until" TIMESTAMPTZ(3),
    "provider_version_id" TEXT,
    "failure_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stored_files_purpose_check" CHECK ("purpose" IN ('EVIDENCE', 'CHAT', 'REPORT')),
    CONSTRAINT "stored_files_state_check" CHECK ("state" IN (
        'UPLOADING', 'QUARANTINED', 'SCANNING', 'READY', 'REJECTED',
        'SCAN_FAILED', 'UPLOAD_FAILED', 'CLEANUP_PENDING', 'DELETED'
    )),
    CONSTRAINT "stored_files_generation_check" CHECK ("generation" >= 1),
    CONSTRAINT "stored_files_scan_attempts_check" CHECK ("scan_attempts" >= 0),
    CONSTRAINT "stored_files_size_check" CHECK ("size_bytes" IS NULL OR "size_bytes" > 0),
    CONSTRAINT "stored_files_sha256_check" CHECK ("sha256" IS NULL OR "sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "stored_files_finalized_check" CHECK (
        "state" IN ('UPLOADING', 'UPLOAD_FAILED', 'CLEANUP_PENDING', 'DELETED')
        OR ("detected_mime" IS NOT NULL AND "size_bytes" IS NOT NULL AND "sha256" IS NOT NULL)
    ),
    CONSTRAINT "stored_files_ready_check" CHECK (
        "state" <> 'READY' OR ("scan_verdict" = 'CLEAN' AND "scanner_version" IS NOT NULL AND "scanned_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "stored_files_object_key_key" ON "stored_files"("object_key");
CREATE INDEX "stored_files_state_created_at_idx" ON "stored_files"("state", "created_at");
CREATE INDEX "stored_files_scan_lease_until_idx" ON "stored_files"("scan_lease_until");

CREATE TABLE "stored_file_scan_events" (
    "id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "generation" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL,
    "lease_token" UUID NOT NULL,
    "verdict" TEXT NOT NULL,
    "scanner_version" TEXT NOT NULL,
    "failure_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stored_file_scan_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stored_file_scan_events_file_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT,
    CONSTRAINT "stored_file_scan_events_verdict_check" CHECK ("verdict" IN ('CLEAN', 'INFECTED', 'UNKNOWN')),
    CONSTRAINT "stored_file_scan_events_attempt_check" CHECK ("attempt" >= 1),
    CONSTRAINT "stored_file_scan_events_unique_lease" UNIQUE ("lease_token")
);

CREATE INDEX "stored_file_scan_events_file_created_idx" ON "stored_file_scan_events"("file_id", "created_at");

CREATE FUNCTION skillhub_guard_stored_file_immutability() RETURNS trigger AS $$
BEGIN
    IF NEW."id" IS DISTINCT FROM OLD."id"
       OR NEW."purpose" IS DISTINCT FROM OLD."purpose"
       OR NEW."uploaded_by" IS DISTINCT FROM OLD."uploaded_by"
       OR NEW."object_key" IS DISTINCT FROM OLD."object_key"
       OR NEW."generation" IS DISTINCT FROM OLD."generation"
       OR NEW."original_name" IS DISTINCT FROM OLD."original_name" THEN
        RAISE EXCEPTION 'stored file identity is immutable';
    END IF;
    IF OLD."state" <> 'UPLOADING' AND (
        NEW."detected_mime" IS DISTINCT FROM OLD."detected_mime"
        OR NEW."size_bytes" IS DISTINCT FROM OLD."size_bytes"
        OR NEW."sha256" IS DISTINCT FROM OLD."sha256"
    ) THEN
        RAISE EXCEPTION 'stored file bytes metadata is immutable after finalize';
    END IF;
    IF OLD."state" = 'READY' AND (
        NEW."state" <> 'READY'
        OR NEW."scan_verdict" IS DISTINCT FROM OLD."scan_verdict"
        OR NEW."scanner_version" IS DISTINCT FROM OLD."scanner_version"
        OR NEW."scanned_at" IS DISTINCT FROM OLD."scanned_at"
    ) THEN
        RAISE EXCEPTION 'ready stored file scan evidence is immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "stored_files_guard_immutability"
BEFORE UPDATE ON "stored_files"
FOR EACH ROW EXECUTE FUNCTION skillhub_guard_stored_file_immutability();
