-- Voucher redemption may spend any Credit lot source; record the lots consumed so refunds restore them.
CREATE TABLE "voucher_redemption_lots" (
    "redemption_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "voucher_redemption_lots_pkey" PRIMARY KEY ("redemption_id", "lot_id"),
    CONSTRAINT "voucher_redemption_lots_amount_check" CHECK ("amount" > 0)
);

ALTER TABLE "voucher_redemption_lots" ADD CONSTRAINT "voucher_redemption_lots_redemption_id_fkey" FOREIGN KEY ("redemption_id") REFERENCES "voucher_redemptions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "voucher_redemption_lots" ADD CONSTRAINT "voucher_redemption_lots_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "credit_lots"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
