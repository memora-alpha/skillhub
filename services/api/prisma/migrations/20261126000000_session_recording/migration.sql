-- Session recording (spec 020): consented LiveKit Egress recordings per Session.

-- CreateEnum
CREATE TYPE "SessionRecordingStatus" AS ENUM ('REQUESTED', 'DECLINED', 'REQUEST_EXPIRED', 'STARTING', 'RECORDING', 'STOPPING', 'READY', 'FAILED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "SessionRecordingKind" AS ENUM ('ROOM_COMPOSITE_VIDEO', 'AUDIO_ONLY');

-- CreateEnum
CREATE TYPE "SessionRecordingStopReason" AS ENUM ('PARTICIPANT', 'WINDOW_CLOSED', 'ROOM_FINISHED', 'MAX_DURATION', 'DISABLED');

-- CreateTable
CREATE TABLE "session_recordings" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "accepted_by_user_id" UUID,
    "status" "SessionRecordingStatus" NOT NULL DEFAULT 'REQUESTED',
    "kind" "SessionRecordingKind" NOT NULL,
    "egress_id" VARCHAR(64),
    "object_key" VARCHAR(512),
    "bytes" BIGINT,
    "duration_ms" BIGINT,
    "requested_at" TIMESTAMPTZ(3) NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "stopped_by_user_id" UUID,
    "stop_reason" "SessionRecordingStopReason",
    "failure_code" VARCHAR(64),
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "session_recordings_pkey" PRIMARY KEY ("id"),
    -- The other participant accepts; nobody accepts their own request.
    CONSTRAINT "session_recordings_accepted_by_check" CHECK ("accepted_by_user_id" IS NULL OR "accepted_by_user_id" <> "requested_by_user_id"),
    -- Egress runs only after acceptance.
    CONSTRAINT "session_recordings_accepted_check" CHECK ("status" IN ('REQUESTED', 'DECLINED', 'REQUEST_EXPIRED') OR "accepted_by_user_id" IS NOT NULL),
    CONSTRAINT "session_recordings_size_check" CHECK (("bytes" IS NULL OR "bytes" >= 0) AND ("duration_ms" IS NULL OR "duration_ms" >= 0)),
    CONSTRAINT "session_recordings_ended_after_start_check" CHECK ("ended_at" IS NULL OR "started_at" IS NULL OR "ended_at" >= "started_at"),
    -- A playable recording has a file.
    CONSTRAINT "session_recordings_ready_file_check" CHECK ("status" <> 'READY' OR "object_key" IS NOT NULL),
    -- Removal records when, and a participant deletion records who.
    CONSTRAINT "session_recordings_removed_check" CHECK ("status" NOT IN ('EXPIRED', 'DELETED') OR "deleted_at" IS NOT NULL),
    CONSTRAINT "session_recordings_deleted_by_check" CHECK (("status" = 'DELETED') = ("deleted_by_user_id" IS NOT NULL))
);

-- CreateIndex
CREATE UNIQUE INDEX "session_recordings_egress_id_key" ON "session_recordings"("egress_id");

-- CreateIndex
CREATE INDEX "session_recordings_session_id_requested_at_idx" ON "session_recordings"("session_id", "requested_at");

-- CreateIndex
CREATE INDEX "session_recordings_status_requested_at_idx" ON "session_recordings"("status", "requested_at");

-- CreateIndex
CREATE INDEX "session_recordings_requested_by_user_id_idx" ON "session_recordings"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "session_recordings_accepted_by_user_id_idx" ON "session_recordings"("accepted_by_user_id");

-- One active request or recording per Session (not expressible in the Prisma schema).
CREATE UNIQUE INDEX "session_recordings_one_active_per_session" ON "session_recordings"("session_id") WHERE "status" IN ('REQUESTED', 'STARTING', 'RECORDING', 'STOPPING');

-- AddForeignKey
ALTER TABLE "session_recordings" ADD CONSTRAINT "session_recordings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "session_recordings" ADD CONSTRAINT "session_recordings_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "session_recordings" ADD CONSTRAINT "session_recordings_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
