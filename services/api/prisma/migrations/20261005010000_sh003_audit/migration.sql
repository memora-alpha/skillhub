-- SH-003 extends the audit_logs table created by the identity migration, so
-- identity security events and AuditWriter rows share one append-only history.
ALTER TABLE "audit_logs"
  ADD COLUMN "actor_kind" TEXT,
  ADD COLUMN "actor_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "system_actor" TEXT,
  ADD COLUMN "correlation_id" UUID,
  ALTER COLUMN "reason" SET DATA TYPE VARCHAR(2000);

-- AuditWriter rows carry actor_kind; identity security events leave it NULL.
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_check" CHECK (
  "actor_kind" IS NULL
  OR ("actor_kind" = 'HUMAN' AND "actor_id" IS NOT NULL AND "system_actor" IS NULL AND cardinality("actor_roles") > 0)
  OR ("actor_kind" = 'SYSTEM' AND "actor_id" IS NULL AND "system_actor" IS NOT NULL AND cardinality("actor_roles") = 0)
);
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_writer_check" CHECK (
  "actor_kind" IS NULL
  OR (
    "reason" IS NOT NULL AND char_length(btrim("reason")) BETWEEN 1 AND 2000
    AND "request_id" IS NOT NULL AND "correlation_id" IS NOT NULL
  )
);

-- identity already rejects row UPDATE/DELETE; TRUNCATE needs a statement trigger.
CREATE TRIGGER audit_no_truncate
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();

COMMENT ON TABLE "audit_logs" IS 'Append-only audit history. Runtime DB role should have only SELECT and INSERT; migration/operator role remains separate.';
