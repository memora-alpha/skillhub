ALTER TABLE users ADD COLUMN notification_preferences JSONB;
ALTER TABLE users ADD COLUMN profile_moderation JSONB;
ALTER TABLE reviews ADD COLUMN moderation_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reviews ADD CONSTRAINT reviews_moderation_version_nonnegative CHECK (moderation_version >= 0);
-- The existing refund workflow writes REFUNDED; the old SUCCESS-only check
-- prevented the entire refund transaction from committing.
ALTER TABLE material_orders DROP CONSTRAINT material_orders_status_check;
ALTER TABLE material_orders ADD CONSTRAINT material_orders_status_check CHECK (status IN ('SUCCESS','REFUNDED'));
ALTER TABLE fee_policy_versions ADD COLUMN created_by UUID REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE fee_policy_versions ADD COLUMN created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD CONSTRAINT users_notification_preferences_valid CHECK (
  notification_preferences IS NULL OR (
    jsonb_typeof(notification_preferences)='object'
    AND notification_preferences - ARRAY['learning','credit','community']::text[] = '{}'::jsonb
    AND (NOT notification_preferences ? 'learning' OR jsonb_typeof(notification_preferences->'learning')='boolean')
    AND (NOT notification_preferences ? 'credit' OR jsonb_typeof(notification_preferences->'credit')='boolean')
    AND (NOT notification_preferences ? 'community' OR jsonb_typeof(notification_preferences->'community')='boolean')
  )
);
CREATE INDEX sharing_skills_user_created_idx ON sharing_skills(user_id, created_at DESC, sharing_skill_id DESC);
CREATE INDEX sessions_teacher_page_idx ON sessions(teacher_id, start_at, session_id);
CREATE INDEX sessions_learner_page_idx ON sessions(learner_id, start_at, session_id);
CREATE INDEX materials_owner_page_idx ON materials(owner_id, updated_at DESC, material_id DESC);
CREATE INDEX materials_staff_page_idx ON materials(status, updated_at, material_id);
CREATE INDEX material_orders_buyer_page_idx ON material_orders(buyer_id, created_at DESC, order_id DESC);
CREATE INDEX fee_policies_page_idx ON fee_policy_versions(created_at DESC, policy_id DESC);
CREATE INDEX fee_policies_creator_idx ON fee_policy_versions(created_by);
INSERT INTO permissions(permission_id,code,description)
SELECT gen_random_uuid(), code, code FROM (VALUES
 ('profile:moderate'),('review:moderate'),('fee-policy:manage')
) AS added(code) ON CONFLICT(code) DO NOTHING;
-- New operational powers remain opt-in for Staff through Admin-managed overrides.
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.role_id,p.permission_id FROM roles r CROSS JOIN permissions p
WHERE r.code='ADMIN' AND p.code IN ('profile:moderate','review:moderate','fee-policy:manage')
ON CONFLICT DO NOTHING;
