CREATE INDEX stored_files_chat_moderation_queue_idx ON stored_files (id)
WHERE purpose = 'CHAT' AND resource_type = 'CHAT_MESSAGE'
  AND (moderation_assessment ->> 'outcome') IN ('BLOCK', 'REVIEW', 'FAILED');

CREATE OR REPLACE FUNCTION skillhub_guard_stored_file_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pending_chat_scan boolean;
BEGIN
  pending_chat_scan := OLD.purpose = 'CHAT' AND OLD.resource_type = 'CHAT_MESSAGE'
    AND (
      (OLD.state = 'QUARANTINED' AND NEW.state = 'SCANNING')
      OR (OLD.state = 'SCANNING' AND NEW.state IN ('QUARANTINED', 'READY', 'REJECTED', 'SCAN_FAILED'))
    );
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.purpose IS DISTINCT FROM OLD.purpose
    OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by OR NEW.object_key IS DISTINCT FROM OLD.object_key
    OR NEW.generation IS DISTINCT FROM OLD.generation OR NEW.original_name IS DISTINCT FROM OLD.original_name THEN
    RAISE EXCEPTION 'stored file identity is immutable';
  END IF;
  IF OLD.state <> 'UPLOADING' AND (NEW.detected_mime IS DISTINCT FROM OLD.detected_mime
    OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes OR NEW.sha256 IS DISTINCT FROM OLD.sha256) THEN
    RAISE EXCEPTION 'stored file bytes metadata is immutable after finalize';
  END IF;
  IF OLD.attached_at IS NOT NULL AND (NEW.attached_at IS DISTINCT FROM OLD.attached_at
    OR NEW.resource_type IS DISTINCT FROM OLD.resource_type OR NEW.resource_id IS DISTINCT FROM OLD.resource_id
    OR (NEW.state IS DISTINCT FROM OLD.state AND pending_chat_scan IS NOT TRUE)) THEN
    RAISE EXCEPTION 'attached stored file binding is immutable';
  END IF;
  IF OLD.state = 'READY' AND (
    (NEW.state <> 'READY' AND NOT (NEW.state = 'CLEANUP_PENDING' AND OLD.purpose = 'EVIDENCE' AND OLD.attached_at IS NULL AND NEW.attached_at IS NULL))
    OR NEW.scan_verdict IS DISTINCT FROM OLD.scan_verdict OR NEW.scanner_version IS DISTINCT FROM OLD.scanner_version
    OR NEW.scanned_at IS DISTINCT FROM OLD.scanned_at) THEN
    RAISE EXCEPTION 'ready stored file scan evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION skillhub_chat_attachment_availability_feed() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  conversation_key uuid;
  recipient uuid;
  event_source uuid;
  available_state text;
BEGIN
  IF NEW.purpose <> 'CHAT' OR NEW.resource_type IS DISTINCT FROM 'CHAT_MESSAGE'
    OR NEW.resource_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.state IS NOT DISTINCT FROM OLD.state
    AND (NEW.moderation_assessment ->> 'outcome' IS NOT DISTINCT FROM 'BLOCK')
        = (OLD.moderation_assessment ->> 'outcome' IS NOT DISTINCT FROM 'BLOCK')
    THEN RETURN NEW; END IF;

  SELECT p.conversation_id INTO conversation_key FROM chat_publications p
  WHERE p.id = NEW.resource_id AND p.status IN ('COMMITTED', 'DELIVERED');
  IF NOT FOUND THEN RETURN NEW; END IF;

  available_state := CASE
    WHEN NEW.state = 'REJECTED' OR NEW.moderation_assessment ->> 'outcome' = 'BLOCK' THEN 'REVOKED'
    WHEN NEW.state = 'READY' THEN 'AVAILABLE'
    WHEN NEW.state IN ('QUARANTINED', 'SCANNING') THEN 'PENDING_SCAN'
    ELSE 'UNAVAILABLE'
  END;
  -- QUARANTINED and SCANNING have the same participant availability.
  IF available_state = 'PENDING_SCAN' THEN RETURN NEW; END IF;
  event_source := skillhub_event_uuid(
    'chat-file-availability:' || jsonb_build_array(NEW.id, NEW.generation, available_state)::text
  );
  FOR recipient IN
    SELECT party FROM conversations c
    CROSS JOIN LATERAL (VALUES (c.participant_a_id), (c.participant_b_id)) AS parties(party)
    WHERE c.conversation_id = conversation_key
    ORDER BY party
  LOOP
    PERFORM skillhub_append_user_event(
      recipient, event_source, 'chat.attachment.availability.updated',
      jsonb_build_object('conversationId', conversation_key, 'messageId', NEW.resource_id, 'fileId', NEW.id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER chat_attachment_availability_feed
AFTER UPDATE OF state, moderation_assessment ON stored_files
FOR EACH ROW EXECUTE FUNCTION skillhub_chat_attachment_availability_feed();
