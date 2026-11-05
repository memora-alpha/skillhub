-- No backfill: historical Hold contracts must not silently adopt a new cancellation policy.
ALTER TABLE held_credit_allocations ADD COLUMN session_credit_snapshot JSONB;
ALTER TABLE held_credit_allocations ADD CONSTRAINT session_credit_snapshot_shape CHECK (
  session_credit_snapshot IS NULL OR (
    ((purpose = 'COMMITMENT' AND beneficiary_id IS NULL
      AND session_credit_snapshot->>'policy' = 'TWO_WAY_SESSION_V1')
    OR (purpose = 'TEACHING_PAYMENT' AND beneficiary_id IS NOT NULL
      AND session_credit_snapshot->>'policy' = 'ONE_WAY_SESSION_V1'))
    AND jsonb_typeof(session_credit_snapshot) = 'object'
    AND session_credit_snapshot->>'feeBps' = '400'
    AND session_credit_snapshot->>'totalUnits' = amount::text
    AND jsonb_typeof(session_credit_snapshot->'sessions') = 'array'
    AND jsonb_array_length(session_credit_snapshot->'sessions') >= 1
  ) IS TRUE
);

CREATE FUNCTION protect_session_credit_snapshot() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.session_credit_snapshot IS NOT NULL THEN
      RAISE EXCEPTION 'SESSION_CREDIT_SNAPSHOT_IMMUTABLE';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.session_credit_snapshot IS DISTINCT FROM OLD.session_credit_snapshot
    OR (OLD.session_credit_snapshot IS NOT NULL AND (
      NEW.path_id IS DISTINCT FROM OLD.path_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.amount IS DISTINCT FROM OLD.amount
      OR NEW.locked_path_version IS DISTINCT FROM OLD.locked_path_version
      OR NEW.purpose IS DISTINCT FROM OLD.purpose
      OR NEW.beneficiary_id IS DISTINCT FROM OLD.beneficiary_id
    )) THEN
    RAISE EXCEPTION 'SESSION_CREDIT_SNAPSHOT_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER session_credit_snapshot_immutable
  BEFORE UPDATE OR DELETE ON held_credit_allocations
  FOR EACH ROW EXECUTE FUNCTION protect_session_credit_snapshot();
