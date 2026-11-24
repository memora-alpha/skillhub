CREATE FUNCTION skillhub_chat_file_moderation_feed() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE event_source uuid;
BEGIN
  -- Dedupe the logical decision, even when a retry changes diagnostic metadata.
  event_source := skillhub_event_uuid(
    'chat-file-moderation:' || jsonb_build_array(
      NEW.id,
      NEW.generation,
      NEW.moderation_assessment ->> 'outcome',
      NEW.moderation_assessment ->> 'profanityVersion',
      NEW.moderation_assessment ->> 'extractorRevision',
      NEW.moderation_assessment ->> 'enforced'
    )::text
  );
  PERFORM skillhub_append_user_event(
    NEW.uploaded_by,
    event_source,
    'chat.attachment.updated',
    jsonb_build_object('fileId', NEW.id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER chat_file_moderation_feed
AFTER UPDATE OF moderation_assessment ON stored_files
FOR EACH ROW
WHEN (
  NEW.purpose = 'CHAT'
  AND NEW.state = 'READY'
  AND NEW.scan_verdict = 'CLEAN'
  AND NEW.moderation_assessment IS DISTINCT FROM OLD.moderation_assessment
  AND NEW.moderation_assessment ->> 'sourceVersion' = NEW.generation::text
  AND NEW.moderation_assessment ->> 'digest' = NEW.sha256
  AND NEW.moderation_assessment ->> 'outcome' IN ('ALLOW', 'BLOCK', 'REVIEW', 'FAILED')
)
EXECUTE FUNCTION skillhub_chat_file_moderation_feed();
