ALTER TABLE users ADD COLUMN staff_permission_version INTEGER NOT NULL DEFAULT 0
  CHECK (staff_permission_version >= 0);
ALTER TABLE skill_verifications ADD COLUMN submitted_role VARCHAR(10)
  CHECK (submitted_role IN ('USER','STAFF','ADMIN'));
CREATE TABLE user_permission_overrides (
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  permission_id UUID NOT NULL REFERENCES permissions(permission_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  effect VARCHAR(5) NOT NULL CHECK (effect IN ('GRANT','DENY')),
  updated_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, permission_id)
);
CREATE INDEX user_permission_overrides_permission_idx ON user_permission_overrides(permission_id);
CREATE INDEX user_permission_overrides_actor_idx ON user_permission_overrides(updated_by);
INSERT INTO permissions(permission_id, code, description)
VALUES (gen_random_uuid(), 'staff-permissions:manage', 'Manage individual staff operational permissions')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r CROSS JOIN permissions p
WHERE r.code='ADMIN' AND p.code='staff-permissions:manage'
ON CONFLICT DO NOTHING;
