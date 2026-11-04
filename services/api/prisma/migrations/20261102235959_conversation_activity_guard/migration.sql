-- Run before Inbox activity backfill, including on databases with existing chats.
-- Only the derived activity timestamp is mutable; every identity field stays frozen.
CREATE OR REPLACE FUNCTION skillhub_guard_conversation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW) - 'last_activity_at') IS DISTINCT FROM (to_jsonb(OLD) - 'last_activity_at') THEN
   RAISE EXCEPTION 'Conversation membership is immutable';
  END IF;
  RETURN NEW;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM proposals p WHERE p.proposal_id=NEW.proposal_id AND p.status='ACCEPTED'
  AND p.proposer_id=NEW.participant_a_id AND p.recipient_id=NEW.participant_b_id AND p.request_id IS NOT DISTINCT FROM NEW.request_id) THEN
  RAISE EXCEPTION 'Conversation requires its accepted proposal';
 END IF;
 RETURN NEW;
END $$;
