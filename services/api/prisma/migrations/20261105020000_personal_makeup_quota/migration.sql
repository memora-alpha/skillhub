-- Attribute makeup to the requester/absent user, not to a teaching direction.
ALTER TABLE sessions ADD COLUMN makeup_user_ids UUID[] NOT NULL DEFAULT '{}';

WITH charged AS (
  SELECT session_id, requester_id AS user_id FROM learning_change_requests
    WHERE kind='SESSION_CANCELLATION' AND status='APPLIED'
  UNION
  SELECT o.session_id, s.teacher_id FROM session_attendance_outcomes o
    JOIN sessions s USING (session_id)
    WHERE (o.resolution='MAKEUP_REQUIRED' OR o.evidence->>'makeupGranted'='true') AND o.teacher_verdict::text='ABSENT'
  UNION
  SELECT o.session_id, s.learner_id FROM session_attendance_outcomes o
    JOIN sessions s USING (session_id)
    WHERE (o.resolution='MAKEUP_REQUIRED' OR o.evidence->>'makeupGranted'='true') AND o.learner_verdict::text='ABSENT'
), attributed AS (
  SELECT session_id, array_agg(DISTINCT user_id ORDER BY user_id) AS user_ids FROM charged GROUP BY session_id
)
UPDATE sessions s SET makeup_user_ids=a.user_ids FROM attributed a
  WHERE s.session_id=a.session_id AND s.makeup_count>0;

ALTER TABLE sessions ADD CONSTRAINT session_makeup_users_check CHECK (
  (makeup_count>0 OR makeup_user_ids='{}'::uuid[]) AND (
    makeup_user_ids='{}'::uuid[] OR makeup_user_ids=ARRAY[teacher_id]
    OR makeup_user_ids=ARRAY[learner_id] OR makeup_user_ids=ARRAY[teacher_id,learner_id]
    OR makeup_user_ids=ARRAY[learner_id,teacher_id]
  )
);

-- Once attributed, an existing grant cannot be moved to another person's quota.
CREATE OR REPLACE FUNCTION guard_session_policy_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    NEW.original_start_at := COALESCE(NEW.original_start_at, NEW.start_at);
  ELSE
    IF NEW.original_start_at IS DISTINCT FROM OLD.original_start_at
       OR NEW.reschedule_count < OLD.reschedule_count OR NEW.makeup_count < OLD.makeup_count
       OR (cardinality(OLD.makeup_user_ids)>0 AND NEW.makeup_user_ids IS DISTINCT FROM OLD.makeup_user_ids) THEN
      RAISE EXCEPTION 'SESSION_POLICY_HISTORY_IMMUTABLE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
