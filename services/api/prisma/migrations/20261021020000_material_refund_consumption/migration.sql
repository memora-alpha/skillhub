-- SH-129: record the first signed download so the 24-hour refund rule can
-- reject orders whose paid content has already been made accessible.
ALTER TABLE "material_orders"
  ADD COLUMN "consumed_at" TIMESTAMPTZ(3);
