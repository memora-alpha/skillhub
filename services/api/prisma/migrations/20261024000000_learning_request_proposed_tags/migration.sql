-- Proposed labels belong to the post until Staff/Admin approves it.
-- Existing posts retain their tags and moderation state.
ALTER TABLE learning_requests
  ADD COLUMN proposed_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD CONSTRAINT learning_requests_proposed_tags_count_check
    CHECK (cardinality(proposed_tags) <= 10),
  ADD CONSTRAINT learning_requests_proposed_tags_review_check
    CHECK (cardinality(proposed_tags) = 0 OR status IN (
      'DRAFT', 'PENDING_MODERATION', 'REJECTED', 'CANCELLED', 'EXPIRED'
    ));
