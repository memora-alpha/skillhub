ALTER TABLE stored_files ADD COLUMN upload_finalized_at timestamptz(3);

CREATE TABLE chat_content_verdict_cache (
  cache_key text PRIMARY KEY,
  lease_token uuid,
  expires_at timestamptz NOT NULL,
  verdict jsonb
);
CREATE INDEX chat_content_verdict_cache_expiry_idx ON chat_content_verdict_cache (expires_at);

CREATE SEQUENCE chat_attachment_state_revision_seq;

CREATE OR REPLACE FUNCTION skillhub_chat_attachment_availability_feed() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  conversation_key uuid;
  recipient uuid;
  revision bigint;
  before_outcome text;
  after_outcome text;
BEGIN
  IF NEW.purpose <> 'CHAT' OR NEW.resource_type IS DISTINCT FROM 'CHAT_MESSAGE'
    OR NEW.resource_id IS NULL THEN RETURN NEW; END IF;
  before_outcome := CASE WHEN OLD.state IN ('REJECTED', 'SCAN_FAILED') THEN OLD.state
    ELSE COALESCE(OLD.moderation_assessment ->> 'outcome', 'PENDING') END;
  after_outcome := CASE WHEN NEW.state IN ('REJECTED', 'SCAN_FAILED') THEN NEW.state
    ELSE COALESCE(NEW.moderation_assessment ->> 'outcome', 'PENDING') END;
  IF before_outcome = after_outcome
    AND (NEW.moderation_assessment ->> 'enforced') IS NOT DISTINCT FROM (OLD.moderation_assessment ->> 'enforced')
    AND (NEW.moderation_assessment ->> 'profanityVersion') IS NOT DISTINCT FROM (OLD.moderation_assessment ->> 'profanityVersion')
    AND (NEW.moderation_assessment -> 'image') IS NOT DISTINCT FROM (OLD.moderation_assessment -> 'image')
  THEN RETURN NEW; END IF;

  SELECT p.conversation_id INTO conversation_key FROM chat_publications p
  WHERE p.id = NEW.resource_id AND p.status IN ('COMMITTED', 'DELIVERED');
  IF NOT FOUND THEN RETURN NEW; END IF;
  revision := nextval('chat_attachment_state_revision_seq');
  FOR recipient IN SELECT party FROM conversations c
    CROSS JOIN LATERAL (VALUES (c.participant_a_id), (c.participant_b_id)) AS parties(party)
    WHERE c.conversation_id = conversation_key ORDER BY party
  LOOP
    PERFORM skillhub_append_user_event(recipient,
      skillhub_event_uuid('chat-attachment-revision:' || revision::text),
      'chat.attachment.availability.updated',
      jsonb_build_object('conversationId', conversation_key, 'messageId', NEW.resource_id,
        'fileId', NEW.id, 'stateRevision', revision::text));
  END LOOP;
  RETURN NEW;
END;
$$;
