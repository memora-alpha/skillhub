-- Staff/Admin have one explicit role; grant only access to their own inbox/feed.
-- Existing domain authorization still filters every event projected by /events.
BEGIN;
INSERT INTO permissions (permission_id, code, description)
SELECT gen_random_uuid(), code, code
FROM unnest(ARRAY[
  'notification:read:self', 'notification:update:self', 'event:read:self'
]) AS code
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r CROSS JOIN permissions p
WHERE r.code IN ('STAFF', 'ADMIN')
  AND p.code IN ('notification:read:self', 'notification:update:self', 'event:read:self')
ON CONFLICT DO NOTHING;
COMMIT;
