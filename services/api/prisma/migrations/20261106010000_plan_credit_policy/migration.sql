-- Retain immutable historical V1 snapshots; V2 scopes each commitment to its owner's teaching plan.
ALTER TABLE learning_paths ADD COLUMN termination_approved_at TIMESTAMPTZ(3);
ALTER TABLE learning_change_requests ADD COLUMN approved_at TIMESTAMPTZ(3);
CREATE INDEX learning_change_approved_recovery ON learning_change_requests(change_request_id)
  WHERE kind = 'PATH_TERMINATION' AND status = 'ACCEPTED' AND approved_at IS NOT NULL;
ALTER TABLE learning_change_requests ADD CONSTRAINT termination_approval_state CHECK (
  approved_at IS NULL OR (kind = 'PATH_TERMINATION' AND status IN ('ACCEPTED','APPLIED'))
);
CREATE FUNCTION protect_termination_approval() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.approved_at IS NOT NULL AND NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'TERMINATION_APPROVAL_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER termination_approval_immutable BEFORE UPDATE ON learning_change_requests
  FOR EACH ROW EXECUTE FUNCTION protect_termination_approval();
ALTER TABLE held_credit_allocations DROP CONSTRAINT session_credit_snapshot_shape;
ALTER TABLE held_credit_allocations ADD CONSTRAINT session_credit_snapshot_shape CHECK (
  session_credit_snapshot IS NULL OR (
    ((purpose = 'COMMITMENT' AND beneficiary_id IS NULL AND (
       session_credit_snapshot->>'policy' = 'TWO_WAY_SESSION_V1' OR (
         session_credit_snapshot->>'policy' = 'TWO_WAY_PLAN_V2'
         AND session_credit_snapshot->>'ownerId' = user_id::text)))
     OR (purpose = 'TEACHING_PAYMENT' AND beneficiary_id IS NOT NULL
       AND session_credit_snapshot->>'policy' = 'ONE_WAY_SESSION_V1'))
    AND jsonb_typeof(session_credit_snapshot) = 'object'
    AND session_credit_snapshot->>'feeBps' = '400'
    AND session_credit_snapshot->>'totalUnits' = amount::text
    AND jsonb_typeof(session_credit_snapshot->'sessions') = 'array'
    AND jsonb_array_length(session_credit_snapshot->'sessions') >= 1
  ) IS TRUE
);
