BEGIN;

ALTER TABLE learning_paths ADD COLUMN last_activity_at TIMESTAMPTZ(3);

-- Reconstruct only timestamped business facts. updated_at may include technical
-- writes/replays and is deliberately excluded. Do not promote every path to now.
WITH facts AS (
  SELECT path_id, GREATEST(created_at, completed_at, settled_at,
    termination_approved_at, participant_a_settlement_approved_at,
    participant_b_settlement_approved_at) AS happened_at FROM learning_paths
  UNION ALL
  SELECT path_id, GREATEST(created_at, participant_a_confirmed_at,
    participant_b_confirmed_at) FROM learning_path_versions
  UNION ALL
  SELECT p.path_id, GREATEST(v.created_at, v.learner_confirmed_at)
    FROM learning_plan_versions v JOIN learning_plans p ON p.plan_id = v.plan_id
  UNION ALL
  SELECT path_id, created_at FROM learning_plans
  UNION ALL
  SELECT path_id, GREATEST(created_at, participant_a_confirmed_at,
    participant_b_confirmed_at) FROM schedule_versions
  UNION ALL
  SELECT s.path_id, h.applied_at FROM session_schedule_history h
    JOIN sessions s ON s.session_id = h.session_id
), latest AS (
  SELECT path_id, MAX(happened_at) AS happened_at FROM facts GROUP BY path_id
)
UPDATE learning_paths p SET last_activity_at = latest.happened_at
FROM latest WHERE p.path_id = latest.path_id;

ALTER TABLE learning_paths ALTER COLUMN last_activity_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE learning_paths ALTER COLUMN last_activity_at SET NOT NULL;

CREATE INDEX learning_paths_participant_a_activity_idx
  ON learning_paths (participant_a_id, last_activity_at DESC, path_id DESC);
CREATE INDEX learning_paths_participant_b_activity_idx
  ON learning_paths (participant_b_id, last_activity_at DESC, path_id DESC);

-- This is a Path-owned derived projection. The caller already locks its Path
-- before changing plans/schedules. Ignore updated_at, fee pinning and retry data.
CREATE FUNCTION skillhub_path_activity_state() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.current_version, NEW.locked_version, NEW.status, NEW.completed_at,
    NEW.termination_approved_at, NEW.settled_at, NEW.settled_path_version,
    NEW.participant_a_settlement_approved_at, NEW.participant_b_settlement_approved_at)
    IS DISTINCT FROM
    ROW(OLD.current_version, OLD.locked_version, OLD.status, OLD.completed_at,
    OLD.termination_approved_at, OLD.settled_at, OLD.settled_path_version,
    OLD.participant_a_settlement_approved_at, OLD.participant_b_settlement_approved_at)
  THEN
    NEW.last_activity_at := GREATEST(OLD.last_activity_at, clock_timestamp());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER learning_path_activity_state BEFORE UPDATE ON learning_paths
FOR EACH ROW EXECUTE FUNCTION skillhub_path_activity_state();

CREATE FUNCTION skillhub_path_activity_child() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target_path UUID;
BEGIN
  IF TG_TABLE_NAME = 'learning_path_versions' THEN
    IF TG_OP = 'UPDATE' THEN
      IF ROW(NEW.participant_a_confirmed_at, NEW.participant_b_confirmed_at)
        IS NOT DISTINCT FROM ROW(OLD.participant_a_confirmed_at, OLD.participant_b_confirmed_at)
      THEN RETURN NEW; END IF;
    END IF;
    SELECT path_id INTO target_path FROM learning_paths
      WHERE path_id = NEW.path_id AND current_version = NEW.version_no;
  ELSIF TG_TABLE_NAME = 'learning_plans' THEN
    IF TG_OP = 'UPDATE' THEN
      IF ROW(NEW.current_version, NEW.status) IS NOT DISTINCT FROM ROW(OLD.current_version, OLD.status)
      THEN RETURN NEW; END IF;
    END IF;
    target_path := NEW.path_id;
  ELSIF TG_TABLE_NAME = 'learning_plan_versions' THEN
    IF NEW.learner_confirmed_at IS NOT DISTINCT FROM OLD.learner_confirmed_at
    THEN RETURN NEW; END IF;
    SELECT path_id INTO target_path FROM learning_plans
      WHERE plan_id = NEW.plan_id AND current_version = NEW.version_no;
  ELSIF TG_TABLE_NAME = 'schedule_proposals' THEN
    IF TG_OP = 'UPDATE' THEN
      IF ROW(NEW.current_version, NEW.applied_version, NEW.status)
        IS NOT DISTINCT FROM ROW(OLD.current_version, OLD.applied_version, OLD.status)
      THEN RETURN NEW; END IF;
    END IF;
    target_path := NEW.path_id;
  ELSIF TG_TABLE_NAME = 'schedule_versions' THEN
    IF ROW(NEW.participant_a_confirmed_at, NEW.participant_b_confirmed_at)
      IS NOT DISTINCT FROM ROW(OLD.participant_a_confirmed_at, OLD.participant_b_confirmed_at)
    THEN RETURN NEW; END IF;
    SELECT p.path_id INTO target_path FROM schedule_proposals p
      JOIN learning_paths l ON l.path_id = p.path_id
      WHERE p.schedule_proposal_id = NEW.schedule_proposal_id
        AND p.current_version = NEW.version_no AND l.current_version = NEW.path_version;
  END IF;
  IF target_path IS NOT NULL THEN
    UPDATE learning_paths SET last_activity_at = GREATEST(last_activity_at, clock_timestamp())
      WHERE path_id = target_path;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER learning_path_activity_agreement AFTER INSERT OR UPDATE ON learning_path_versions
FOR EACH ROW EXECUTE FUNCTION skillhub_path_activity_child();
CREATE TRIGGER learning_path_activity_plan AFTER INSERT OR UPDATE ON learning_plans
FOR EACH ROW EXECUTE FUNCTION skillhub_path_activity_child();
CREATE TRIGGER learning_path_activity_plan_confirmation AFTER UPDATE ON learning_plan_versions
FOR EACH ROW EXECUTE FUNCTION skillhub_path_activity_child();
CREATE TRIGGER learning_path_activity_schedule AFTER INSERT OR UPDATE ON schedule_proposals
FOR EACH ROW EXECUTE FUNCTION skillhub_path_activity_child();
CREATE TRIGGER learning_path_activity_schedule_confirmation AFTER UPDATE ON schedule_versions
FOR EACH ROW EXECUTE FUNCTION skillhub_path_activity_child();

COMMIT;
