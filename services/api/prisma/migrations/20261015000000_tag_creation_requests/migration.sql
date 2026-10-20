-- Legacy labels are preserved; this key is used only to backfill existing rows.
-- The preflight/postflight command compares every SQL key with the Node policy.
CREATE FUNCTION pg_temp.skillhub_tag_key(value text) RETURNS text
LANGUAGE SQL IMMUTABLE STRICT AS $$
  SELECT lower(btrim(regexp_replace(normalize(value, NFC),
    U&'[\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF]+', ' ', 'g')))
$$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM tags WHERE label ~ U&'[\0001-\001F\007F-\009F]'
    OR char_length(pg_temp.skillhub_tag_key(label)) NOT BETWEEN 1 AND 80) THEN
    RAISE EXCEPTION 'INVALID_LEGACY_TAG_LABEL: run tag preflight before migrating';
  END IF;
  IF EXISTS (SELECT pg_temp.skillhub_tag_key(label) FROM tags
    GROUP BY pg_temp.skillhub_tag_key(label) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'TAG_LABEL_COLLISION: resolve explicitly; no automatic merge';
  END IF;
END $$;

ALTER TABLE tags ADD COLUMN label_key TEXT,
  ADD COLUMN created_by_user_id UUID,
  ADD COLUMN created_at TIMESTAMPTZ(3),
  ADD COLUMN updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
UPDATE tags SET label_key = pg_temp.skillhub_tag_key(label);
ALTER TABLE tags ALTER COLUMN label_key SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
  ADD CONSTRAINT tags_creator_fkey FOREIGN KEY (created_by_user_id)
    REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT tags_version_check CHECK (version > 0);
CREATE UNIQUE INDEX tags_label_key_key ON tags(label_key);
CREATE INDEX tags_created_by_user_id_idx ON tags(created_by_user_id);

CREATE TYPE "TagCreationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TABLE tag_creation_requests (
  tag_request_id UUID PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  label_key TEXT NOT NULL,
  requested_by_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  status "TagCreationRequestStatus" NOT NULL DEFAULT 'PENDING',
  reviewed_by_user_id UUID REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  reviewed_at TIMESTAMPTZ(3),
  result_tag_id UUID REFERENCES tags(tag_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  reject_reason TEXT,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT tag_request_version_check CHECK (version > 0),
  CONSTRAINT tag_request_label_check CHECK (char_length(label) BETWEEN 1 AND 80 AND char_length(label_key) > 0),
  CONSTRAINT tag_request_decision_check CHECK (
    (status = 'PENDING' AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL AND result_tag_id IS NULL AND reject_reason IS NULL)
    OR (status = 'APPROVED' AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND result_tag_id IS NOT NULL AND reject_reason IS NULL)
    OR (status = 'REJECTED' AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND result_tag_id IS NULL AND reject_reason IS NOT NULL AND char_length(btrim(reject_reason)) BETWEEN 1 AND 2000)
  )
);
CREATE UNIQUE INDEX tag_request_pending_owner_label_key ON tag_creation_requests(requested_by_user_id,label_key) WHERE status = 'PENDING';
CREATE INDEX tag_request_queue_idx ON tag_creation_requests(status,created_at DESC,tag_request_id DESC);
CREATE INDEX tag_request_owner_idx ON tag_creation_requests(requested_by_user_id,created_at DESC,tag_request_id DESC);
CREATE INDEX tag_request_reviewer_idx ON tag_creation_requests(reviewed_by_user_id);
CREATE INDEX tag_request_result_idx ON tag_creation_requests(result_tag_id);
