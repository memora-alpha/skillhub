-- Derived Inbox ordering; message content/time remains authoritative in MongoDB.
ALTER TABLE conversations ADD COLUMN last_activity_at TIMESTAMPTZ(3);
UPDATE conversations SET last_activity_at = created_at;
ALTER TABLE conversations ALTER COLUMN last_activity_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE conversations ALTER COLUMN last_activity_at SET NOT NULL;
CREATE INDEX conversations_participant_a_activity_idx
  ON conversations (participant_a_id, last_activity_at DESC, conversation_id DESC);
CREATE INDEX conversations_participant_b_activity_idx
  ON conversations (participant_b_id, last_activity_at DESC, conversation_id DESC);
-- Existing message history must be backfilled from Mongo before exposing the new order:
-- pnpm --filter api chat:backfill-activity
