-- Align the migrated v3 schema with the current runtime Prisma model.
-- No account or domain records are removed.
BEGIN;

ALTER TABLE "skill_evidence" DROP CONSTRAINT "skill_evidence_stored_file_id_fkey";
ALTER TABLE "skill_evidence" ADD CONSTRAINT "skill_evidence_stored_file_id_fkey"
  FOREIGN KEY ("stored_file_id") REFERENCES "stored_files"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "skill_verification_queue_idx";
ALTER TABLE "sharing_skills" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "skills" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER INDEX "audit_logs_created_at_id_idx" RENAME TO "audit_logs_created_at_audit_id_idx";
ALTER INDEX "avatar_assets_user_id_id_key" RENAME TO "avatar_assets_user_id_asset_id_key";
ALTER INDEX "reauth_proofs_digest_key" RENAME TO "reauth_proofs_token_digest_key";
ALTER INDEX "refresh_sessions_user_id_id_key" RENAME TO "refresh_sessions_user_id_session_id_key";

COMMIT;
