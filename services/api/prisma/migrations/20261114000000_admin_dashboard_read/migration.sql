INSERT INTO permissions(permission_id, code, description)
VALUES (gen_random_uuid(), 'dashboard:read', 'Read system dashboard statistics')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN' AND p.code = 'dashboard:read'
ON CONFLICT DO NOTHING;
