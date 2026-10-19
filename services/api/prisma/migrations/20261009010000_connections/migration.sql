-- Fail before modifying legacy suggestions: their unit/source identity is unknown.
BEGIN;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM proposals WHERE proposed_credit IS NOT NULL OR source_type='DIRECT_SEARCH') THEN
    RAISE EXCEPTION 'Connection preflight: review legacy credit units and direct target identity before migrating';
  END IF;
END $$;
ALTER TABLE proposals ADD COLUMN version integer NOT NULL DEFAULT 1,
 ADD COLUMN updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN terminal_at timestamptz(3), ADD COLUMN exchange_type_hint "ExchangeType",
 ADD COLUMN target_sharing_skill_id uuid REFERENCES sharing_skills(sharing_skill_id) ON DELETE RESTRICT;
UPDATE proposals SET expires_at=created_at+interval '7 days' WHERE expires_at IS NULL;
ALTER TABLE proposals ALTER COLUMN expires_at SET NOT NULL;
ALTER TABLE proposals ADD CONSTRAINT proposal_connection_values CHECK (
 proposer_id<>recipient_id AND version>0 AND expires_at>created_at AND
 char_length(message) BETWEEN 10 AND 1000 AND
 (proposed_duration_minutes IS NULL OR proposed_duration_minutes BETWEEN 60 AND 180) AND
 (initial_session_count IS NULL OR initial_session_count>0) AND
 (proposed_credit IS NULL OR (exchange_type_hint IS NOT NULL AND proposed_credit>0 AND proposed_credit<=999999999999
  AND (exchange_type_hint<>'TWO_WAY' OR proposed_credit>=2000))) AND
 ((source_type='LEARNING_REQUEST' AND request_id IS NOT NULL AND target_sharing_skill_id IS NULL)
  OR (source_type='DIRECT_SEARCH' AND request_id IS NULL AND target_sharing_skill_id IS NOT NULL)));
CREATE UNIQUE INDEX proposal_pending_request_party ON proposals(request_id,proposer_id) WHERE status='PENDING' AND request_id IS NOT NULL;
CREATE UNIQUE INDEX proposal_pending_direct_party ON proposals(proposer_id,recipient_id,skill_id) WHERE status='PENDING' AND request_id IS NULL;
CREATE UNIQUE INDEX proposal_accepted_request ON proposals(request_id) WHERE status='ACCEPTED' AND request_id IS NOT NULL;
CREATE UNIQUE INDEX conversation_request_unique ON conversations(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX proposals_status_expires_at_idx ON proposals(status,expires_at);
CREATE INDEX proposals_proposer_id_created_at_proposal_id_idx ON proposals(proposer_id,created_at DESC,proposal_id DESC);
CREATE INDEX proposals_recipient_id_created_at_proposal_id_idx ON proposals(recipient_id,created_at DESC,proposal_id DESC);
ALTER TABLE conversations ADD CONSTRAINT conversation_distinct_parties CHECK(participant_a_id<>participant_b_id);

CREATE TABLE chat_publications (
 id uuid PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES conversations(conversation_id) ON DELETE RESTRICT,
 sender_id uuid NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT, client_message_id uuid NOT NULL,
 command_digest text NOT NULL, draft_digest text, draft_format_version integer NOT NULL DEFAULT 1,
 delivered_event_id uuid NOT NULL UNIQUE, status text NOT NULL DEFAULT 'PREPARING', message_sequence bigint,
 failure_code text, created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(conversation_id,sender_id,client_message_id),
 CHECK(status IN ('PREPARING','COMMITTED','DELIVERED','CANCELLED')),
 CHECK(status NOT IN ('COMMITTED','DELIVERED') OR draft_digest IS NOT NULL),
 CHECK(status<>'DELIVERED' OR message_sequence>0));
CREATE INDEX chat_publications_status_created_at_idx ON chat_publications(status,created_at);
CREATE INDEX chat_publications_sender_id_created_at_idx ON chat_publications(sender_id,created_at);
CREATE TABLE user_event_streams (
 user_id uuid PRIMARY KEY REFERENCES users(user_id) ON DELETE RESTRICT,
 epoch uuid NOT NULL DEFAULT gen_random_uuid(), last_sequence bigint NOT NULL DEFAULT 0,
 first_retained_sequence bigint NOT NULL DEFAULT 1,
 CHECK(last_sequence>=0 AND first_retained_sequence BETWEEN 1 AND last_sequence+1));
CREATE TABLE user_event_deliveries (
 user_id uuid NOT NULL REFERENCES user_event_streams(user_id) ON DELETE RESTRICT,
 sequence bigint NOT NULL CHECK(sequence>0), event_id uuid NOT NULL, type text NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version>0), payload jsonb NOT NULL,
 occurred_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,sequence), UNIQUE(user_id,event_id));

-- Lock the recipient counter before allocating: sequence order equals commit order.
-- Deterministic UUID is derived from source + public type + recipient.
CREATE FUNCTION skillhub_event_uuid(value text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT (substr(md5(value),1,8)||'-'||substr(md5(value),9,4)||'-5'||substr(md5(value),14,3)||'-8'||substr(md5(value),18,3)||'-'||substr(md5(value),21,12))::uuid
$$;
CREATE FUNCTION skillhub_append_user_event(recipient uuid, source uuid, event_type text, refs jsonb)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE seq bigint; eid uuid;
BEGIN
 eid=skillhub_event_uuid(source::text||':'||event_type||':'||recipient::text);
 INSERT INTO user_event_streams(user_id) VALUES(recipient) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM user_event_streams WHERE user_id=recipient FOR UPDATE;
 -- Outbox receipts are retained: retries must also dedupe after replay-prefix trimming.
 IF EXISTS(SELECT 1 FROM outbox_events WHERE event_id=eid) THEN RETURN; END IF;
 UPDATE user_event_streams SET last_sequence=last_sequence+1 WHERE user_id=recipient RETURNING last_sequence INTO seq;
 INSERT INTO user_event_deliveries(user_id,sequence,event_id,type,payload) VALUES(recipient,seq,eid,event_type,refs);
 INSERT INTO outbox_events(event_id,event_type,aggregate_type,aggregate_id,aggregate_version,payload,dedupe_key,correlation_id)
 VALUES(eid,'application.events.wakeup','application.events.wakeup',eid::text,1,jsonb_build_object('userId',recipient),eid::text,source);
END $$;

CREATE FUNCTION skillhub_notification_feed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM skillhub_append_user_event(NEW.user_id,NEW.notification_id,'notification.created',jsonb_build_object('notificationId',NEW.notification_id));
 ELSIF OLD.read_at IS NULL AND NEW.read_at IS NOT NULL THEN
  PERFORM skillhub_append_user_event(NEW.user_id,NEW.notification_id,'notification.read',jsonb_build_object('notificationId',NEW.notification_id));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notification_feed AFTER INSERT OR UPDATE OF read_at ON notifications FOR EACH ROW EXECUTE FUNCTION skillhub_notification_feed();

CREATE FUNCTION skillhub_chat_file_feed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.purpose='CHAT' AND NEW.state IS DISTINCT FROM OLD.state THEN
  PERFORM skillhub_append_user_event(NEW.uploaded_by,skillhub_event_uuid(NEW.id::text||':'||NEW.state||':'||NEW.generation),
   'chat.attachment.updated',jsonb_build_object('fileId',NEW.id));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER chat_file_feed AFTER UPDATE OF state ON stored_files FOR EACH ROW EXECUTE FUNCTION skillhub_chat_file_feed();

CREATE FUNCTION skillhub_guard_proposal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.proposal_id<>OLD.proposal_id OR NEW.source_type<>OLD.source_type OR NEW.request_id IS DISTINCT FROM OLD.request_id
  OR NEW.proposer_id<>OLD.proposer_id OR NEW.recipient_id<>OLD.recipient_id OR NEW.skill_id<>OLD.skill_id
  OR NEW.target_sharing_skill_id IS DISTINCT FROM OLD.target_sharing_skill_id OR NEW.expires_at<>OLD.expires_at
  OR NEW.created_at<>OLD.created_at OR OLD.status<>'PENDING' OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Proposal identity, expiry or terminal state is immutable';
 END IF;
 IF NEW.status<>'PENDING' AND NEW.terminal_at IS NULL THEN RAISE EXCEPTION 'Terminal proposal requires timestamp'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER proposal_immutability BEFORE UPDATE ON proposals FOR EACH ROW EXECUTE FUNCTION skillhub_guard_proposal();
CREATE FUNCTION skillhub_guard_conversation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Conversation membership is immutable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM proposals p WHERE p.proposal_id=NEW.proposal_id AND p.status='ACCEPTED'
  AND p.proposer_id=NEW.participant_a_id AND p.recipient_id=NEW.participant_b_id AND p.request_id IS NOT DISTINCT FROM NEW.request_id) THEN
  RAISE EXCEPTION 'Conversation requires its accepted proposal';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conversation_immutability BEFORE INSERT OR UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION skillhub_guard_conversation();
CREATE FUNCTION skillhub_guard_chat_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NOT EXISTS(SELECT 1 FROM conversations WHERE conversation_id=NEW.conversation_id AND NEW.sender_id IN(participant_a_id,participant_b_id)) THEN
   RAISE EXCEPTION 'Publication sender must be a participant'; END IF;
 ELSE
  IF NEW.id<>OLD.id OR NEW.conversation_id<>OLD.conversation_id OR NEW.sender_id<>OLD.sender_id OR NEW.client_message_id<>OLD.client_message_id
   OR NEW.command_digest<>OLD.command_digest OR NEW.delivered_event_id<>OLD.delivered_event_id OR NEW.draft_format_version<>OLD.draft_format_version
   OR (OLD.draft_digest IS NOT NULL AND NEW.draft_digest IS DISTINCT FROM OLD.draft_digest)
   OR (OLD.status='DELIVERED' AND (NEW.status<>OLD.status OR NEW.message_sequence IS DISTINCT FROM OLD.message_sequence))
   OR (OLD.status='COMMITTED' AND NEW.status NOT IN('COMMITTED','DELIVERED')) OR (OLD.status='CANCELLED' AND NEW.status<>'CANCELLED') THEN
   RAISE EXCEPTION 'Publication identity and committed content are immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER chat_publication_immutability BEFORE INSERT OR UPDATE ON chat_publications FOR EACH ROW EXECUTE FUNCTION skillhub_guard_chat_publication();

INSERT INTO permissions(permission_id,code,description)
SELECT gen_random_uuid(),code,code FROM unnest(ARRAY[
 'event:read:self','proposal:create','proposal:read:party','proposal:update:self','proposal:accept:recipient','proposal:reject:recipient','proposal:withdraw:self',
 'conversation:read:participant','message:create:participant','message:delivery:read:self','conversation:read-state:update:self',
 'message:attachment:create:participant','message:attachment:read:participant']) AS code ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id)
 SELECT r.role_id,p.permission_id FROM roles r CROSS JOIN permissions p WHERE r.code='USER' AND p.code IN(
 'event:read:self','proposal:create','proposal:read:party','proposal:update:self','proposal:accept:recipient','proposal:reject:recipient','proposal:withdraw:self',
 'conversation:read:participant','message:create:participant','message:delivery:read:self','conversation:read-state:update:self',
 'message:attachment:create:participant','message:attachment:read:participant') ON CONFLICT DO NOTHING;
COMMIT;
