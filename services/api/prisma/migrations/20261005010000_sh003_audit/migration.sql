CREATE TABLE "audit_logs" (
  "audit_id" UUID NOT NULL,
  "actor_kind" TEXT NOT NULL,
  "actor_user_id" UUID,
  "actor_roles" TEXT[] NOT NULL,
  "system_actor" TEXT,
  "action" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "reason" TEXT NOT NULL,
  "request_id" UUID NOT NULL,
  "correlation_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_id"),
  CONSTRAINT "audit_logs_actor_check" CHECK (
    ("actor_kind" = 'HUMAN' AND "actor_user_id" IS NOT NULL AND "system_actor" IS NULL AND cardinality("actor_roles") > 0)
    OR ("actor_kind" = 'SYSTEM' AND "actor_user_id" IS NULL AND "system_actor" IS NOT NULL AND cardinality("actor_roles") = 0)
  ),
  CONSTRAINT "audit_logs_reason_check" CHECK (char_length(btrim("reason")) BETWEEN 1 AND 2000)
);

CREATE INDEX "audit_logs_target_type_target_id_created_at_idx"
  ON "audit_logs"("target_type", "target_id", "created_at");
CREATE INDEX "audit_logs_actor_user_id_created_at_idx"
  ON "audit_logs"("actor_user_id", "created_at");

CREATE FUNCTION reject_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_log_mutation();

COMMENT ON TABLE "audit_logs" IS 'Append-only audit history. Runtime DB role should have only SELECT and INSERT; migration/operator role remains separate.';
