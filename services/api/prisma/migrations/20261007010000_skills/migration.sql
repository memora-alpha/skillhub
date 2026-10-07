-- Additive feature migration. Historical enum VERIFIED maps to API APPROVED.
ALTER TABLE skills ADD COLUMN name_key text,
  ADD COLUMN created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN version integer NOT NULL DEFAULT 1;
UPDATE skills SET name_key=lower(btrim(regexp_replace(normalize(name,NFC),'\s+',' ','g')))
WHERE name_key IS NULL;
DO $$ DECLARE conflict_ids text; BEGIN
  SELECT string_agg(skill_id::text,',') INTO conflict_ids FROM skills
  WHERE name_key IN (SELECT name_key FROM skills GROUP BY name_key HAVING count(*)>1);
  IF conflict_ids IS NOT NULL THEN RAISE EXCEPTION 'Skill name collision IDs: %', conflict_ids; END IF;
END $$;
ALTER TABLE skills ALTER COLUMN name_key SET NOT NULL;
CREATE UNIQUE INDEX skills_name_key_key ON skills(name_key);
ALTER TABLE skills ADD CONSTRAINT skill_feature_values CHECK (
  char_length(name) BETWEEN 2 AND 100 AND char_length(coalesce(description,''))<=500
  AND char_length(name_key)>0 AND version>0);
ALTER TABLE sharing_skills ADD COLUMN created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN version integer NOT NULL DEFAULT 1;
DO $$ DECLARE conflict_ids text; BEGIN
  SELECT string_agg(sharing_skill_id::text,',') INTO conflict_ids FROM sharing_skills
  WHERE archived_at IS NULL AND (user_id,skill_id) IN (
    SELECT user_id,skill_id FROM sharing_skills WHERE archived_at IS NULL GROUP BY user_id,skill_id HAVING count(*)>1);
  IF conflict_ids IS NOT NULL THEN RAISE EXCEPTION 'Active sharing skill collision IDs: %', conflict_ids; END IF;
END $$;
CREATE UNIQUE INDEX sharing_skills_active_unique ON sharing_skills(user_id,skill_id) WHERE archived_at IS NULL;
ALTER TABLE sharing_skills ADD CONSTRAINT sharing_skill_feature_values CHECK (
  char_length(description) BETWEEN 20 AND 1500 AND (experience_years IS NULL OR experience_years BETWEEN 0 AND 60) AND version>0);
ALTER TABLE skill_verifications ADD COLUMN version integer NOT NULL DEFAULT 1;
DO $$ DECLARE conflict_ids text; BEGIN
  SELECT string_agg(verification_id::text,',') INTO conflict_ids FROM skill_verifications
  WHERE status='PENDING' AND sharing_skill_id IN (
    SELECT sharing_skill_id FROM skill_verifications WHERE status='PENDING' GROUP BY sharing_skill_id HAVING count(*)>1);
  IF conflict_ids IS NOT NULL THEN RAISE EXCEPTION 'Pending verification collision IDs: %', conflict_ids; END IF;
END $$;
CREATE UNIQUE INDEX skill_verifications_pending_unique ON skill_verifications(sharing_skill_id) WHERE status='PENDING';
ALTER TABLE skill_verifications ADD CONSTRAINT verification_decision_values CHECK (
  version>0 AND (status='PENDING' OR (reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL))
  AND (status<>'REJECTED' OR char_length(coalesce(reject_reason,'')) BETWEEN 10 AND 500));
ALTER TABLE stored_files ADD COLUMN attached_at timestamptz(3), ADD COLUMN resource_type text, ADD COLUMN resource_id uuid;
ALTER TABLE stored_files ADD CONSTRAINT stored_file_binding CHECK (
  (attached_at IS NULL AND resource_type IS NULL AND resource_id IS NULL) OR
  (attached_at IS NOT NULL AND resource_type IS NOT NULL AND resource_id IS NOT NULL));
-- Permit only unattached READY evidence to enter orphan cleanup. Preserve immutable
-- bytes/scan facts and make an established resource binding permanent.
CREATE OR REPLACE FUNCTION skillhub_guard_stored_file_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.purpose IS DISTINCT FROM OLD.purpose
    OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by OR NEW.object_key IS DISTINCT FROM OLD.object_key
    OR NEW.generation IS DISTINCT FROM OLD.generation OR NEW.original_name IS DISTINCT FROM OLD.original_name THEN
    RAISE EXCEPTION 'stored file identity is immutable';
  END IF;
  IF OLD.state<>'UPLOADING' AND (NEW.detected_mime IS DISTINCT FROM OLD.detected_mime
    OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes OR NEW.sha256 IS DISTINCT FROM OLD.sha256) THEN
    RAISE EXCEPTION 'stored file bytes metadata is immutable after finalize';
  END IF;
  IF OLD.attached_at IS NOT NULL AND (NEW.attached_at IS DISTINCT FROM OLD.attached_at
    OR NEW.resource_type IS DISTINCT FROM OLD.resource_type OR NEW.resource_id IS DISTINCT FROM OLD.resource_id
    OR NEW.state IS DISTINCT FROM OLD.state) THEN
    RAISE EXCEPTION 'attached stored file binding is immutable';
  END IF;
  IF OLD.state='READY' AND (
    (NEW.state<>'READY' AND NOT (NEW.state='CLEANUP_PENDING' AND OLD.purpose='EVIDENCE' AND OLD.attached_at IS NULL AND NEW.attached_at IS NULL))
    OR NEW.scan_verdict IS DISTINCT FROM OLD.scan_verdict OR NEW.scanner_version IS DISTINCT FROM OLD.scanner_version
    OR NEW.scanned_at IS DISTINCT FROM OLD.scanned_at) THEN
    RAISE EXCEPTION 'ready stored file scan evidence is immutable';
  END IF;
  RETURN NEW;
END $$;
ALTER TABLE skill_evidence ADD COLUMN stored_file_id uuid;
CREATE UNIQUE INDEX skill_evidence_stored_file_id_key ON skill_evidence(stored_file_id);
ALTER TABLE skill_evidence ADD CONSTRAINT skill_evidence_stored_file_id_fkey FOREIGN KEY(stored_file_id) REFERENCES stored_files(id) ON DELETE RESTRICT;
-- Existing metadata is retained. Unbound legacy evidence is inaccessible and cannot be approved.
ALTER TABLE skill_evidence ADD CONSTRAINT evidence_feature_values CHECK (
  file_size_bytes BETWEEN 1 AND 10000000 AND
  (approval_status<>'REJECTED' OR char_length(coalesce(reject_reason,'')) BETWEEN 10 AND 500) AND
  (approval_status NOT IN ('APPROVED','REVOKED') OR (approved_at IS NOT NULL AND reviewer_id IS NOT NULL)) AND
  (approval_status<>'REVOKED' OR (revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL AND char_length(coalesce(revoked_reason,'')) BETWEEN 10 AND 500)));
CREATE INDEX sharing_skills_search_idx ON sharing_skills(skill_id,is_visible,verification_status) WHERE archived_at IS NULL;
CREATE INDEX skill_verification_queue_idx ON skill_verifications(status,submitted_at,verification_id);

-- File count and binding checks run at commit, allowing batch insertion in one transaction.
CREATE FUNCTION validate_skill_submission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; count_files integer; BEGIN
  target=NEW.verification_id;
  SELECT count(*) INTO count_files FROM skill_evidence WHERE verification_id=target;
  IF count_files NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Submission must contain 1-5 files'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER skill_submission_files AFTER INSERT ON skill_verifications DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_skill_submission();
CREATE CONSTRAINT TRIGGER skill_evidence_batch AFTER INSERT ON skill_evidence DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_skill_submission();
CREATE FUNCTION validate_skill_file_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stored_file_id IS NULL THEN
    RAISE EXCEPTION 'New evidence requires a stored file binding';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM stored_files f JOIN sharing_skills s ON s.sharing_skill_id=NEW.sharing_skill_id
    JOIN skill_verifications v ON v.verification_id=NEW.verification_id AND v.sharing_skill_id=s.sharing_skill_id
    WHERE f.id=NEW.stored_file_id AND f.uploaded_by=s.user_id AND f.purpose='EVIDENCE'
      AND f.attached_at IS NOT NULL AND f.resource_type='SKILL_EVIDENCE' AND f.resource_id=NEW.evidence_id
      AND f.object_key=NEW.storage_key AND f.sha256=NEW.checksum AND f.size_bytes=NEW.file_size_bytes
  ) THEN RAISE EXCEPTION 'Evidence file binding mismatch'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER evidence_file_binding AFTER INSERT ON skill_evidence DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_skill_file_binding();
