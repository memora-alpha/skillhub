-- Additive policy amendment. Preserve legacy over-limit history; only new grants are limited.
ALTER TABLE sessions
  ADD COLUMN original_start_at TIMESTAMPTZ(3),
  ADD COLUMN reschedule_count INTEGER NOT NULL DEFAULT 0 CHECK (reschedule_count >= 0),
  ADD COLUMN makeup_count INTEGER NOT NULL DEFAULT 0 CHECK (makeup_count >= 0);
ALTER TABLE learning_paths
  ADD COLUMN participant_a_settlement_approved_at TIMESTAMPTZ(3),
  ADD COLUMN participant_b_settlement_approved_at TIMESTAMPTZ(3);

WITH grants AS (
  SELECT session_id, occurrence_start_at FROM learning_change_requests
    WHERE kind = 'SESSION_CANCELLATION' AND status = 'APPLIED'
  UNION
  SELECT session_id, occurrence_start_at FROM session_attendance_outcomes
    WHERE resolution = 'MAKEUP_REQUIRED' OR evidence->>'makeupGranted' = 'true'
), ordered AS (
  SELECT h.session_id, h.applied_at, h.history_id, i.start_at, i.end_at,
    lag(i.start_at) OVER w AS previous_start, lag(i.end_at) OVER w AS previous_end
  FROM session_schedule_history h JOIN schedule_items i USING (schedule_item_id)
  WINDOW w AS (PARTITION BY h.session_id ORDER BY h.applied_at, h.history_id)
), firsts AS (
  SELECT DISTINCT ON (session_id) session_id, start_at FROM ordered
    ORDER BY session_id, applied_at, history_id
), changes AS (
  SELECT o.session_id, count(*)::integer AS count FROM ordered o
  WHERE o.previous_start IS NOT NULL
    AND (o.start_at <> o.previous_start OR o.end_at <> o.previous_end)
    AND NOT EXISTS (SELECT 1 FROM grants g WHERE g.session_id=o.session_id AND g.occurrence_start_at=o.previous_start)
  GROUP BY o.session_id
), makeups AS (
  SELECT session_id, count(*)::integer AS count FROM grants GROUP BY session_id
)
UPDATE sessions s SET
  original_start_at = COALESCE(f.start_at, s.start_at),
  reschedule_count = COALESCE(c.count, 0),
  makeup_count = GREATEST(COALESCE(m.count, 0), CASE WHEN s.status::text='MAKEUP_REQUIRED'
    OR EXISTS (SELECT 1 FROM report_cases r WHERE r.related_session_id=s.session_id AND r.reason_code IN ('MAKEUP_EXPIRED','MAKEUP_LIMIT_REACHED'))
    THEN 1 ELSE 0 END)
FROM (SELECT session_id FROM sessions) ids
LEFT JOIN firsts f USING (session_id)
LEFT JOIN changes c USING (session_id)
LEFT JOIN makeups m USING (session_id)
WHERE s.session_id=ids.session_id;

-- Retain proof of a granted occurrence even when expiry replaces its resolution with STAFF_REVIEW.
UPDATE session_attendance_outcomes o
SET evidence = COALESCE(o.evidence, '{}'::jsonb) || jsonb_build_object('makeupGranted', true)
WHERE o.resolution='MAKEUP_REQUIRED' OR EXISTS (
  SELECT 1 FROM sessions s JOIN report_cases r ON r.related_session_id=s.session_id
  WHERE s.session_id=o.session_id AND s.start_at=o.occurrence_start_at AND s.status::text='DISPUTED'
    AND r.reason_code='MAKEUP_EXPIRED' AND r.status::text IN ('OPEN','UNDER_REVIEW','NEED_MORE_INFO')
);

CREATE FUNCTION guard_session_policy_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    NEW.original_start_at := COALESCE(NEW.original_start_at, NEW.start_at);
  ELSE
    IF NEW.original_start_at IS DISTINCT FROM OLD.original_start_at
       OR NEW.reschedule_count < OLD.reschedule_count OR NEW.makeup_count < OLD.makeup_count THEN
      RAISE EXCEPTION 'SESSION_POLICY_HISTORY_IMMUTABLE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER session_policy_history_guard BEFORE INSERT OR UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION guard_session_policy_history();
