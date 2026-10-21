-- SH-115..118 invariants enforced by PostgreSQL in addition to the API.
-- Preflight: the materials module never shipped, so these tables are expected empty.
ALTER TABLE "materials"
  ADD CONSTRAINT "materials_price_by_access_check" CHECK (
    ("access_type" = 'FREE' AND "price_credit" = 0)
    OR ("access_type" = 'PAID' AND "price_credit" BETWEEN 1 AND 999999999999)
  ),
  ADD CONSTRAINT "materials_text_length_check" CHECK (
    char_length("title") BETWEEN 5 AND 150
    AND char_length("description") BETWEEN 10 AND 3000
  ),
  ADD CONSTRAINT "materials_listing_version_check" CHECK ("listing_version" >= 1),
  ADD CONSTRAINT "materials_published_file_check" CHECK (
    "status" <> 'PUBLISHED' OR (
      "storage_key" IS NOT NULL
      AND "size_bytes" > 0
      AND "scan_status" = 'CLEAN'
      AND "distribution_rights_confirmed_at" IS NOT NULL
    )
  );

ALTER TABLE "material_orders"
  ADD CONSTRAINT "material_orders_parties_check" CHECK ("buyer_id" <> "seller_id"),
  ADD CONSTRAINT "material_orders_amounts_check" CHECK (
    "gross_credit" > 0 AND "fee_amount" >= 0 AND "seller_net_credit" >= 0
    AND "gross_credit" = "fee_amount" + "seller_net_credit"
  ),
  ADD CONSTRAINT "material_orders_status_check" CHECK ("status" = 'SUCCESS');

ALTER TABLE "material_entitlements"
  ADD CONSTRAINT "material_entitlements_status_check" CHECK ("status" IN ('ACTIVE', 'REVOKED')),
  ADD CONSTRAINT "material_entitlements_source_check" CHECK (
    ("source_type" = 'PURCHASE') = ("source_order_id" IS NOT NULL)
  );
