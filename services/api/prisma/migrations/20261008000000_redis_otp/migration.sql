-- Development schema transition: OTP state is Redis-owned.
-- Discard obsolete OTP records and delivery payloads; no archive is retained.
BEGIN;
ALTER TABLE identity_email_deliveries
  DROP COLUMN IF EXISTS challenge_id,
  DROP COLUMN IF EXISTS encrypted_recipient,
  DROP COLUMN IF EXISTS encrypted_payload,
  DROP COLUMN IF EXISTS encryption_key_id,
  DROP COLUMN IF EXISTS last_error_code;
DROP TABLE IF EXISTS otp_challenges;
DROP TABLE IF EXISTS otp_issue_windows;
COMMIT;
