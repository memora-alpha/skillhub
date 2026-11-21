-- Learning fee policies are versioned and pinned when an agreement is locked.
-- Existing immutable snapshots retain feeBps=400; new snapshots may use any
-- approved basis-point rate in the supported [0, 10000) range.
ALTER TABLE held_credit_allocations
  DROP CONSTRAINT session_credit_snapshot_shape;

ALTER TABLE held_credit_allocations
  ADD CONSTRAINT session_credit_snapshot_shape CHECK (
    session_credit_snapshot IS NULL OR (
      ((purpose = 'COMMITMENT' AND beneficiary_id IS NULL AND (
         session_credit_snapshot->>'policy' = 'TWO_WAY_SESSION_V1' OR (
           session_credit_snapshot->>'policy' = 'TWO_WAY_PLAN_V2'
           AND session_credit_snapshot->>'ownerId' = user_id::text)))
       OR (purpose = 'TEACHING_PAYMENT' AND beneficiary_id IS NOT NULL
         AND session_credit_snapshot->>'policy' = 'ONE_WAY_SESSION_V1'))
      AND jsonb_typeof(session_credit_snapshot) = 'object'
      AND CASE
        WHEN session_credit_snapshot->>'feeBps' ~ '^(0|[1-9][0-9]{0,3})$'
          THEN (session_credit_snapshot->>'feeBps')::integer BETWEEN 0 AND 9999
        ELSE false
      END
      AND session_credit_snapshot->>'totalUnits' = amount::text
      AND jsonb_typeof(session_credit_snapshot->'sessions') = 'array'
      AND jsonb_array_length(session_credit_snapshot->'sessions') >= 1
    ) IS TRUE
  );
