import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createMaterialFixture } from "./fixture.mjs";

test("material payment ledger on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const buyer = await f.account();
    const seller = await f.account();
    await f.fund(buyer, 10000n);
    const pay = (gross, fee) =>
      f.transactions.run((tx) =>
        f.credits.purchaseMaterial(tx, {
          orderId: randomUUID(),
          buyerId: buyer.user.id,
          sellerId: seller.user.id,
          gross,
          fee,
        }),
      );
    await t.test(
      "debits gross, credits net and records the fee once",
      async () => {
        const { operationId } = await pay(2000n, 100n);
        const wallets = new Map(
          (
            await f.db.creditWallet.findMany({
              where: { userId: { in: [buyer.user.id, seller.user.id] } },
            })
          ).map((w) => [w.userId, w]),
        );
        assert.equal(wallets.get(buyer.user.id).availableCredit, 8000n);
        assert.equal(wallets.get(buyer.user.id).purchasedCredit, 8000n);
        assert.equal(wallets.get(seller.user.id).availableCredit, 1900n);
        const entries = await f.db.creditTransaction.findMany({
          where: { operationId },
          orderBy: { entryNo: "asc" },
        });
        assert.deepEqual(
          entries.map((e) => [e.type, e.availableDelta, e.availableAfter]),
          [
            ["MATERIAL_PURCHASE", -1900n, 8100n],
            ["PLATFORM_FEE", -100n, 8000n],
            ["MATERIAL_SALE", 1900n, 1900n],
          ],
        );
        // Both wallets still reconcile with their provenance lots.
        await f.transactions.run(async (tx) => {
          await f.credits.lockWallet(tx, buyer.user.id);
          await f.credits.lockWallet(tx, seller.user.id);
        });
      },
    );
    await t.test("zero fee writes no PLATFORM_FEE entry", async () => {
      const { operationId } = await pay(1n, 0n);
      const types = (
        await f.db.creditTransaction.findMany({
          where: { operationId },
          orderBy: { entryNo: "asc" },
        })
      ).map((e) => e.type);
      assert.deepEqual(types, ["MATERIAL_PURCHASE", "MATERIAL_SALE"]);
    });
    await t.test("insufficient Available changes nothing", async () => {
      const before = await f.db.creditTransaction.count();
      await assert.rejects(pay(9000n, 450n), /INSUFFICIENT_AVAILABLE_CREDIT/);
      assert.equal(await f.db.creditTransaction.count(), before);
    });
    await t.test("self payment is rejected", async () => {
      await assert.rejects(
        f.transactions.run((tx) =>
          f.credits.purchaseMaterial(tx, {
            orderId: randomUUID(),
            buyerId: buyer.user.id,
            sellerId: buyer.user.id,
            gross: 100n,
            fee: 5n,
          }),
        ),
        /INVALID_MATERIAL_PAYMENT/,
      );
    });
  } finally {
    await f.dispose();
  }
});
