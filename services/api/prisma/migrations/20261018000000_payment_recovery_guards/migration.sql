BEGIN;
ALTER TABLE payments ADD COLUMN creation_key_digest CHAR(64),
  ADD COLUMN creation_fingerprint CHAR(64);

-- Recover domain identity only from an unambiguous, completed original mapping.
-- Missing history cannot be reconstructed from amount/time; restore requires reconciliation.
DO $$ BEGIN
  IF EXISTS (
    SELECT p.payment_id FROM payments p JOIN idempotency_records i
      ON i.scope = p.user_id::text AND i.result_reference->>'id' = p.payment_id::text
    WHERE i.operation = 'payment:create' AND i.completed_at IS NOT NULL
    GROUP BY p.payment_id HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM payments p JOIN idempotency_records i
      ON i.scope = p.user_id::text AND i.result_reference->>'id' = p.payment_id::text
    WHERE i.operation = 'payment:create' AND i.completed_at IS NOT NULL
      AND (i.key_digest !~ '^[0-9a-f]{64}$' OR i.fingerprint !~ '^[0-9a-f]{64}$')
  ) THEN RAISE EXCEPTION 'Payment creation identity requires reconciliation'; END IF;
END $$;
UPDATE payments p SET creation_key_digest = i.key_digest,
  creation_fingerprint = i.fingerprint
FROM idempotency_records i
WHERE i.scope = p.user_id::text AND i.result_reference->>'id' = p.payment_id::text
  AND i.operation = 'payment:create' AND i.completed_at IS NOT NULL;
ALTER TABLE payments ADD CONSTRAINT payments_creation_identity_check CHECK (
  (creation_key_digest IS NULL AND creation_fingerprint IS NULL) OR
  (creation_key_digest IS NOT NULL AND creation_fingerprint IS NOT NULL
    AND creation_key_digest ~ '^[0-9a-f]{64}$' AND creation_fingerprint ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX payments_user_id_creation_key_digest_key ON payments(user_id,creation_key_digest);
CREATE INDEX payments_user_id_status_created_at_payment_id_idx ON payments(user_id,status,created_at,payment_id);

CREATE FUNCTION protect_payment_creation_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'Payment creation identities must be retained';
  END IF;
  IF OLD.creation_key_digest IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Payment creation identity must be retained';
    END IF;
    IF NEW.payment_id IS DISTINCT FROM OLD.payment_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.creation_key_digest IS DISTINCT FROM OLD.creation_key_digest
      OR NEW.creation_fingerprint IS DISTINCT FROM OLD.creation_fingerprint THEN
      RAISE EXCEPTION 'Payment creation identity is immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_creation_identity_immutable BEFORE UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION protect_payment_creation_identity();
CREATE TRIGGER payment_creation_identity_no_truncate BEFORE TRUNCATE ON payments
FOR EACH STATEMENT EXECUTE FUNCTION protect_payment_creation_identity();
COMMIT;
