-- Additive: retain all existing Session identities, schedules, Holds and ledger history.
-- TWO_WAY termination can credit both participants in one atomic operation.
-- Retain one source lot per operation/beneficiary; all existing rows satisfy this pair identity.
ALTER TABLE credit_lots DROP CONSTRAINT credit_lots_operation_id_key;
CREATE UNIQUE INDEX credit_lots_operation_id_user_id_key ON credit_lots(operation_id,user_id);

CREATE UNIQUE INDEX sessions_session_id_path_id_key ON sessions(session_id, path_id);

CREATE TABLE learning_change_requests (
  change_request_id UUID PRIMARY KEY,
  path_id UUID NOT NULL REFERENCES learning_paths(path_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  session_id UUID,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  version INTEGER NOT NULL DEFAULT 1,
  requester_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  reason VARCHAR(1000) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  instruction_digest CHAR(64) NOT NULL,
  occurrence_start_at TIMESTAMPTZ(3),
  policy_snapshot JSONB NOT NULL,
  responder_id UUID REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  responded_at TIMESTAMPTZ(3),
  accepted BOOLEAN,
  response_note VARCHAR(1000),
  resolved_by_user_id UUID REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  resolution JSONB,
  operation_id UUID UNIQUE REFERENCES credit_operations(operation_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ(3) NOT NULL,
  closed_at TIMESTAMPTZ(3),
  CONSTRAINT learning_change_session_path_fk FOREIGN KEY(session_id,path_id)
    REFERENCES sessions(session_id,path_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT learning_change_kind_check CHECK (
    (kind='SESSION_CANCELLATION' AND session_id IS NOT NULL AND occurrence_start_at IS NOT NULL)
    OR (kind='PATH_TERMINATION' AND session_id IS NULL AND occurrence_start_at IS NULL)),
  CONSTRAINT learning_change_status_check CHECK (status IN ('PENDING','ACCEPTED','STAFF_REVIEW','REJECTED','WITHDRAWN','EXPIRED','APPLIED')),
  CONSTRAINT learning_change_version_check CHECK (version > 0),
  CONSTRAINT learning_change_reason_check CHECK (char_length(btrim(reason)) BETWEEN 3 AND 1000),
  CONSTRAINT learning_change_time_check CHECK (expires_at > created_at),
  CONSTRAINT learning_change_closed_check CHECK ((closed_at IS NULL) = (status IN ('PENDING','ACCEPTED','STAFF_REVIEW'))),
  CONSTRAINT learning_change_response_check CHECK (
    (responder_id IS NULL AND responded_at IS NULL AND accepted IS NULL)
    OR (responder_id IS NOT NULL AND responded_at IS NOT NULL AND accepted IS NOT NULL AND responder_id<>requester_id)),
  CONSTRAINT learning_change_posting_check CHECK (
    (kind='SESSION_CANCELLATION' AND operation_id IS NULL)
    OR (kind='PATH_TERMINATION' AND ((status='APPLIED') = (operation_id IS NOT NULL))))
);
CREATE UNIQUE INDEX learning_change_requests_path_id_requester_id_idempotency_key_key
  ON learning_change_requests(path_id,requester_id,idempotency_key);
CREATE INDEX learning_change_requests_path_id_status_expires_at_idx ON learning_change_requests(path_id,status,expires_at);
CREATE INDEX learning_change_requests_session_id_status_idx ON learning_change_requests(session_id,status);
CREATE INDEX learning_change_requests_status_expires_at_change_request_id_idx ON learning_change_requests(status,expires_at,change_request_id);
-- A fresh key cannot create two active requests for the same target.
CREATE UNIQUE INDEX learning_change_one_open_termination ON learning_change_requests(path_id)
  WHERE kind='PATH_TERMINATION' AND status IN ('PENDING','ACCEPTED','STAFF_REVIEW');
CREATE UNIQUE INDEX learning_change_one_open_cancellation ON learning_change_requests(session_id)
  WHERE kind='SESSION_CANCELLATION' AND status IN ('PENDING','ACCEPTED','STAFF_REVIEW');

CREATE TABLE path_settlement_attempts (
  path_id UUID PRIMARY KEY REFERENCES learning_paths(path_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  checked_at TIMESTAMPTZ(3) NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('WAITING','RETRYING','NEEDS_REVIEW','SETTLED','TERMINATED')),
  error_code VARCHAR(80)
);

-- Identity, original occurrence/reason and policy evidence cannot be rewritten by later decisions.
CREATE FUNCTION guard_learning_change_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'learning change history cannot be deleted'; END IF;
  IF OLD.closed_at IS NOT NULL OR
    ROW(NEW.path_id,NEW.session_id,NEW.kind,NEW.requester_id,NEW.reason,NEW.idempotency_key,
      NEW.instruction_digest,NEW.occurrence_start_at,NEW.policy_snapshot,NEW.created_at,NEW.expires_at)
    IS DISTINCT FROM
    ROW(OLD.path_id,OLD.session_id,OLD.kind,OLD.requester_id,OLD.reason,OLD.idempotency_key,
      OLD.instruction_digest,OLD.occurrence_start_at,OLD.policy_snapshot,OLD.created_at,OLD.expires_at)
  THEN RAISE EXCEPTION 'learning change history is immutable'; END IF;
  IF NEW.version <> OLD.version+1 THEN RAISE EXCEPTION 'learning change version must advance once'; END IF;
  IF OLD.responded_at IS NOT NULL AND
    ROW(NEW.responder_id,NEW.responded_at,NEW.accepted,NEW.response_note)
    IS DISTINCT FROM ROW(OLD.responder_id,OLD.responded_at,OLD.accepted,OLD.response_note)
  THEN RAISE EXCEPTION 'learning change response is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER learning_change_history_guard BEFORE UPDATE OR DELETE ON learning_change_requests
  FOR EACH ROW EXECUTE FUNCTION guard_learning_change_history();
