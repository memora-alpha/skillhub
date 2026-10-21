-- SH-115: learning-material uploads store files with purpose MATERIAL.
-- The original constraint (20261005030000_sh004_stored_files) predates it; the
-- new list is a superset, so existing rows stay valid.
ALTER TABLE "stored_files"
  DROP CONSTRAINT "stored_files_purpose_check",
  ADD CONSTRAINT "stored_files_purpose_check" CHECK (
    "purpose" IN ('EVIDENCE', 'CHAT', 'REPORT', 'MATERIAL')
  );
