-- Schedule suggestions now follow the mobile free-text input.
-- ALTER TYPE rewrites storage without invoking proposal lifecycle UPDATE triggers.
-- Retain populated legacy arrays as JSON text so no timestamp is discarded.
BEGIN;
ALTER TABLE proposals
  ALTER COLUMN candidate_slots DROP DEFAULT,
  ALTER COLUMN candidate_slots DROP NOT NULL;
ALTER TABLE proposals
  ALTER COLUMN candidate_slots TYPE TEXT USING (
    CASE
      WHEN candidate_slots IN ('[]'::jsonb, 'null'::jsonb) THEN NULL
      WHEN jsonb_typeof(candidate_slots) = 'string' THEN candidate_slots #>> '{}'
      ELSE candidate_slots::text
    END
  );
COMMIT;
