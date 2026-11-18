BEGIN;

ALTER TABLE "materials"
  ADD COLUMN "has_been_published" BOOLEAN NOT NULL DEFAULT false;

-- Review metadata can be cleared by submit/withdraw. Recover historical publication
-- from durable moderation evidence and access records, including refunded orders.
UPDATE "materials" AS m
SET "has_been_published" = true
WHERE m."status" = 'PUBLISHED'
   OR m."moderation_status" = 'APPROVED'
   OR EXISTS (
     SELECT 1 FROM "audit_logs" AS a
     WHERE a."target_type" = 'MATERIAL' AND a."target_id" = m."material_id"::text
       AND a."action" = 'MATERIAL_MODERATE'
       AND (a."before_data"->>'status' = 'PUBLISHED'
         OR a."after_data"->>'status' = 'PUBLISHED')
   )
   OR EXISTS (
     SELECT 1 FROM "outbox_events" AS e
     WHERE e."aggregate_type" = 'MATERIAL' AND e."aggregate_id" = m."material_id"::text
       AND e."event_type" = 'material.moderated'
       AND (e."payload"->>'status' = 'PUBLISHED'
         OR e."payload"->>'action' IN ('approve', 'unhide'))
   )
   OR EXISTS (SELECT 1 FROM "material_orders" AS o WHERE o."material_id" = m."material_id")
   OR EXISTS (SELECT 1 FROM "material_entitlements" AS e WHERE e."material_id" = m."material_id")
   OR EXISTS (
     SELECT 1 FROM "material_download_grants" AS g
     WHERE g."material_id" = m."material_id"
       AND g."access_source" IN ('FREE_PUBLIC', 'PAID_ENTITLEMENT')
   );

COMMIT;
