CREATE TABLE report_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), target_type TEXT NOT NULL, target_id TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','RESOLVED','REJECTED')),
  severity VARCHAR(8) NOT NULL CHECK(severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  reason VARCHAR(2000) NOT NULL, handler_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TIMESTAMPTZ(3)
);
CREATE INDEX report_incidents_queue_idx ON report_incidents(status,created_at,id);
ALTER TABLE report_cases ADD COLUMN severity VARCHAR(8) CHECK(severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  ADD COLUMN incident_id UUID REFERENCES report_incidents(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX report_cases_incident_idx ON report_cases(incident_id);
ALTER TABLE report_evidence ADD COLUMN party_id UUID REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD COLUMN stored_file_id UUID UNIQUE REFERENCES stored_files(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
UPDATE report_evidence e SET party_id=c.reporter_id FROM report_cases c
WHERE c.case_id=e.case_id AND c.reporter_id IS NOT NULL;
CREATE TABLE report_message_receipts (
  message_id VARCHAR(64) PRIMARY KEY, case_id UUID NOT NULL REFERENCES report_cases(case_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  party_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT, sender_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  digest CHAR(64) NOT NULL, created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX report_message_receipts_thread_idx ON report_message_receipts(case_id,party_id,created_at,message_id);
INSERT INTO permissions(permission_id,code,description)
SELECT gen_random_uuid(), code, code FROM (VALUES ('report:group'),('report:classify'),('report:communicate')) AS codes(code)
ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.role_id,p.permission_id FROM roles r CROSS JOIN permissions p
WHERE r.code='ADMIN' AND p.code IN ('report:group','report:classify','report:communicate')
ON CONFLICT DO NOTHING;
