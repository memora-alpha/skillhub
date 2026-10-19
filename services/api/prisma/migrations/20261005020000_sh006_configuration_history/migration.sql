CREATE TABLE "system_configuration_revisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "version" INTEGER NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor_snapshot" JSONB NOT NULL,
  "audit_id" UUID,
  CONSTRAINT "system_configuration_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "system_configuration_revisions_key_version_key" UNIQUE ("key", "version"),
  CONSTRAINT "system_configuration_revisions_version_check" CHECK ("version" > 0),
  CONSTRAINT "system_configuration_revisions_key_fkey" FOREIGN KEY ("key") REFERENCES "system_configurations"("key") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "system_configuration_revisions_key_created_at_idx"
  ON "system_configuration_revisions"("key", "created_at" DESC);

-- A migration-time baseline for existing, catalog-valid rows. Unknown or invalid
-- rows remain untouched; the read service will reject them rather than activate
-- an unapproved policy. Fresh approved defaults are inserted by the seed command.
INSERT INTO "system_configuration_revisions"
  ("key", "value", "version", "effective_at", "actor_snapshot")
SELECT "key", "value", "version", "effective_at", '{"kind":"SYSTEM","name":"MIGRATION"}'::jsonb
FROM "system_configurations"
WHERE "version" > 0 AND (
  ("key" = 'learningPath.minCreditPerUser' AND "value" = '20'::jsonb) OR
  ("key" = 'credit.topUpVndPerCredit' AND "value" = '1000'::jsonb) OR
  ("key" = 'credit.pathSettlementBps' AND "value" = '{"returned":9600,"fee":400}'::jsonb) OR
  ("key" = 'session.durationMinutes' AND "value" = '{"min":60,"max":180}'::jsonb) OR
  ("key" = 'schedule.rescheduleCutoffMinutes' AND "value" = '60'::jsonb) OR
  ("key" = 'storage.downloadTtlSeconds' AND
    CASE WHEN jsonb_typeof("value") = 'number' AND ("value" #>> '{}') ~ '^[0-9]{1,3}$'
      THEN ("value" #>> '{}')::integer BETWEEN 1 AND 300 ELSE false END) OR
  ("key" = 'storage.evidenceMaxBytes' AND
    CASE WHEN jsonb_typeof("value") = 'number' AND ("value" #>> '{}') ~ '^[0-9]{1,9}$'
      THEN ("value" #>> '{}')::integer BETWEEN 1 AND 100000000 ELSE false END)
);

CREATE FUNCTION prevent_system_configuration_revision_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'system configuration revisions are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_configuration_revisions_append_only
BEFORE UPDATE OR DELETE ON "system_configuration_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_system_configuration_revision_change();
