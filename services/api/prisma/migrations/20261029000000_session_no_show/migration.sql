-- CreateEnum
CREATE TYPE "AttendanceRole" AS ENUM ('TEACHER', 'LEARNER');

-- CreateEnum
CREATE TYPE "AttendanceCloseSource" AS ENUM ('WEBHOOK', 'HEARTBEAT', 'ROOM_FINISHED');

-- CreateEnum
CREATE TYPE "AttendanceVerdict" AS ENUM ('PRESENT', 'ABSENT', 'UNVERIFIABLE');

-- CreateEnum
CREATE TYPE "AttendanceCase" AS ENUM ('BOTH_PRESENT', 'TEACHER_ABSENT', 'LEARNER_ABSENT', 'BOTH_ABSENT', 'UNVERIFIABLE');

-- CreateEnum
CREATE TYPE "AttendanceOutcomeStatus" AS ENUM ('PROVISIONAL', 'FINAL', 'EXCUSED', 'DISPUTED', 'OVERTURNED');

-- CreateEnum
CREATE TYPE "SessionResolution" AS ENUM ('COMPLETED_MUTUAL', 'COMPLETED_TIMEOUT', 'COMPLETED_LEARNER_NO_SHOW', 'COMPLETED_STAFF', 'MAKEUP_REQUIRED', 'STAFF_REVIEW');

-- CreateEnum
CREATE TYPE "AbsenceExcuseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SessionStatus" ADD VALUE 'NO_SHOW';
ALTER TYPE "SessionStatus" ADD VALUE 'MAKEUP_REQUIRED';

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "confirm_deadline_at" TIMESTAMPTZ(3),
ADD COLUMN     "last_observed_at" TIMESTAMPTZ(3),
ADD COLUMN     "learner_token_issued_at" TIMESTAMPTZ(3),
ADD COLUMN     "makeup_deadline_at" TIMESTAMPTZ(3),
ADD COLUMN     "observation_failed_at" TIMESTAMPTZ(3),
ADD COLUMN     "teacher_token_issued_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "report_cases" ALTER COLUMN "reporter_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "session_attendance_intervals" (
    "interval_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "AttendanceRole" NOT NULL,
    "room_sid" TEXT NOT NULL,
    "participant_sid" TEXT NOT NULL,
    "joined_at" TIMESTAMPTZ(3) NOT NULL,
    "left_at" TIMESTAMPTZ(3),
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
    "close_source" "AttendanceCloseSource",

    CONSTRAINT "session_attendance_intervals_pkey" PRIMARY KEY ("interval_id")
);

-- CreateTable
CREATE TABLE "session_attendance_outcomes" (
    "outcome_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "occurrence_start_at" TIMESTAMPTZ(3) NOT NULL,
    "occurrence_end_at" TIMESTAMPTZ(3) NOT NULL,
    "teacher_verdict" "AttendanceVerdict" NOT NULL,
    "learner_verdict" "AttendanceVerdict" NOT NULL,
    "teacher_late" BOOLEAN NOT NULL,
    "learner_late" BOOLEAN NOT NULL,
    "teacher_seconds" BIGINT NOT NULL,
    "learner_seconds" BIGINT NOT NULL,
    "teacher_first_joined_at" TIMESTAMPTZ(3),
    "learner_first_joined_at" TIMESTAMPTZ(3),
    "attendance_case" "AttendanceCase" NOT NULL,
    "status" "AttendanceOutcomeStatus" NOT NULL,
    "resolution" "SessionResolution",
    "determined_at" TIMESTAMPTZ(3) NOT NULL,
    "finalizes_at" TIMESTAMPTZ(3) NOT NULL,
    "finalized_at" TIMESTAMPTZ(3),
    "evidence" JSONB NOT NULL,

    CONSTRAINT "session_attendance_outcomes_pkey" PRIMARY KEY ("outcome_id")
);

-- CreateTable
CREATE TABLE "session_absence_excuses" (
    "excuse_id" UUID NOT NULL,
    "outcome_id" UUID NOT NULL,
    "absent_user_id" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" "AbsenceExcuseStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "decision_note" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_absence_excuses_pkey" PRIMARY KEY ("excuse_id")
);

-- CreateIndex
CREATE INDEX "session_attendance_intervals_session_id_user_id_idx" ON "session_attendance_intervals"("session_id", "user_id");

-- CreateIndex
CREATE INDEX "session_attendance_intervals_user_id_idx" ON "session_attendance_intervals"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_attendance_intervals_session_id_participant_sid_key" ON "session_attendance_intervals"("session_id", "participant_sid");

-- CreateIndex
CREATE INDEX "session_attendance_outcomes_status_finalizes_at_idx" ON "session_attendance_outcomes"("status", "finalizes_at");

-- CreateIndex
CREATE UNIQUE INDEX "session_attendance_outcomes_session_id_occurrence_start_at_key" ON "session_attendance_outcomes"("session_id", "occurrence_start_at");

-- CreateIndex
CREATE UNIQUE INDEX "session_absence_excuses_outcome_id_key" ON "session_absence_excuses"("outcome_id");

-- CreateIndex
CREATE INDEX "session_absence_excuses_absent_user_id_idx" ON "session_absence_excuses"("absent_user_id");

-- CreateIndex
CREATE INDEX "session_absence_excuses_decided_by_user_id_idx" ON "session_absence_excuses"("decided_by_user_id");

-- CreateIndex
CREATE INDEX "sessions_status_confirm_deadline_at_idx" ON "sessions"("status", "confirm_deadline_at");

-- CreateIndex
CREATE INDEX "sessions_status_makeup_deadline_at_idx" ON "sessions"("status", "makeup_deadline_at");

-- AddForeignKey
ALTER TABLE "session_attendance_intervals" ADD CONSTRAINT "session_attendance_intervals_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "session_attendance_intervals" ADD CONSTRAINT "session_attendance_intervals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "session_attendance_outcomes" ADD CONSTRAINT "session_attendance_outcomes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "session_absence_excuses" ADD CONSTRAINT "session_absence_excuses_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "session_attendance_outcomes"("outcome_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "session_absence_excuses" ADD CONSTRAINT "session_absence_excuses_absent_user_id_fkey" FOREIGN KEY ("absent_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "session_absence_excuses" ADD CONSTRAINT "session_absence_excuses_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Sessions that started or had a token provisioned before attendance tracking have no interval
-- evidence. Mark their observation as failed and their tokens as issued so the
-- first determination yields UNVERIFIABLE instead of a penalised ABSENT.
UPDATE "sessions"
SET "observation_failed_at" = "start_at",
    "teacher_token_issued_at" = "start_at",
    "learner_token_issued_at" = "start_at"
WHERE "status" IN ('CONFIRMED', 'READY', 'ONGOING', 'AWAITING_CONFIRMATION')
  AND ("start_at" <= CURRENT_TIMESTAMP OR "room_name" IS NOT NULL);
