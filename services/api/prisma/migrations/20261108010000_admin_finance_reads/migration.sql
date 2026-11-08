INSERT INTO permissions(permission_id, code, description)
SELECT gen_random_uuid(), code, code FROM (VALUES
  ('credit:read:any'), ('payment:read:any'), ('payment:reconcile')
) AS codes(code)
ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r CROSS JOIN permissions p
WHERE r.code='ADMIN' AND p.code IN ('credit:read:any','payment:read:any','payment:reconcile')
ON CONFLICT DO NOTHING;
CREATE INDEX credit_transactions_admin_order_idx ON credit_transactions(created_at DESC, transaction_id DESC);
CREATE INDEX payments_admin_order_idx ON payments(created_at DESC, payment_id DESC);
