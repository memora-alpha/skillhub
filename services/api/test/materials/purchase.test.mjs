import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createMaterialFixture } from "./fixture.mjs";

const available = async (f, account) =>
  (await f.db.creditWallet.findUnique({ where: { userId: account.user.id } }))
    ?.availableCredit ?? 0n;
const served = (link, key) => link.url.endsWith(`key=${key}`);

test("PAID material purchase on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const seller = await f.account();
    const buyer = await f.account();
    await f.fund(buyer, 5000n); // 50.00 Credit
    const paid = await f.publishedMaterial(seller, {
      accessType: "PAID",
      priceCredit: "20",
    });
    const buy = (account, key = randomUUID(), version = paid.listingVersion) =>
      f.purchases.purchase(account.principal, paid.id, version, key);

    await t.test(
      "rejects self purchase, stale price and missing key",
      async () => {
        await assert.rejects(buy(seller), /MATERIAL_SELF_PURCHASE/);
        await assert.rejects(
          buy(buyer, randomUUID(), paid.listingVersion + 1),
          /MATERIAL_PRICE_CHANGED/,
        );
        await assert.rejects(buy(buyer, ""), /IDEMPOTENCY_KEY_REQUIRED/);
      },
    );
    let first;
    await t.test(
      "charges 20.00, pays seller 19.00, grants entitlement",
      async () => {
        first = await buy(buyer, "order-1");
        assert.equal(first.replayed, false);
        assert.equal(first.order.grossCredit, "20.00");
        assert.equal(first.order.feeAmount, "1.00");
        assert.equal(first.order.sellerNetCredit, "19.00");
        assert.equal(await available(f, buyer), 3000n);
        assert.equal(await available(f, seller), 1900n);
        const link = await f.catalog.download(buyer.principal, paid.id);
        assert.ok(link.url);
      },
    );
    await t.test("retry and re-purchase never charge twice", async () => {
      const retry = await buy(buyer, "order-1");
      const again = await buy(buyer, "order-2");
      assert.equal(retry.replayed, true);
      assert.equal(again.replayed, true);
      assert.equal(retry.order.id, first.order.id);
      assert.equal(again.order.id, first.order.id);
      assert.equal(await available(f, buyer), 3000n);
      assert.equal(await f.db.materialOrder.count(), 1);
    });
    await t.test("a key reused for another material is rejected", async () => {
      const other = await f.publishedMaterial(seller, {
        title: "Another paid material",
        accessType: "PAID",
        priceCredit: "5",
      });
      await assert.rejects(
        f.purchases.purchase(
          buyer.principal,
          other.id,
          other.listingVersion,
          "order-1",
        ),
        /IDEMPOTENCY_KEY_REUSED/,
      );
      assert.equal(await available(f, buyer), 3000n);
    });
    await t.test("concurrent purchases by one buyer charge once", async () => {
      const racer = await f.account();
      await f.fund(racer, 5000n);
      const results = await Promise.all(
        Array.from({ length: 4 }, () => buy(racer)),
      );
      assert.equal(new Set(results.map((r) => r.order.id)).size, 1);
      assert.equal(await available(f, racer), 3000n);
    });
    await t.test(
      "insufficient balance fails without order or entitlement",
      async () => {
        const poor = await f.account();
        await f.fund(poor, 1000n);
        await assert.rejects(buy(poor), /INSUFFICIENT_AVAILABLE_CREDIT/);
        assert.equal(
          await f.db.materialEntitlement.count({
            where: { userId: poor.user.id },
          }),
          0,
        );
        assert.equal(await available(f, poor), 1000n);
      },
    );
    await t.test(
      "no approved MATERIAL_PAID policy blocks purchase",
      async () => {
        const approved = await f.db.feePolicyVersion.findMany({
          where: { policyCode: "MATERIAL_PAID", status: "APPROVED" },
          select: { id: true },
        });
        const where = { id: { in: approved.map((row) => row.id) } };
        await f.db.feePolicyVersion.updateMany({
          where,
          data: { status: "DRAFT" },
        });
        try {
          const late = await f.account();
          await f.fund(late, 5000n);
          await assert.rejects(buy(late), /MATERIAL_FEE_POLICY_UNAVAILABLE/);
          assert.equal(await available(f, late), 5000n);
        } finally {
          await f.db.feePolicyVersion.updateMany({
            where,
            data: { status: "APPROVED" },
          });
        }
      },
    );
    await t.test(
      "price change keeps the old order and file snapshot",
      async () => {
        const { storageKey: original } = await f.db.material.findUniqueOrThrow({
          where: { id: paid.id },
        });
        const file = await f.materialFile(seller);
        assert.notEqual(file.objectKey, original);
        const edited = await f.materials.update(seller.principal, paid.id, {
          expectedListingVersion: paid.listingVersion,
          priceCredit: "30",
          fileId: file.id,
          distributionRightsConfirmed: true,
        });
        await f.moderation.moderate(f.moderator.principal, paid.id, "approve", {
          expectedListingVersion: edited.listingVersion,
        });
        const order = await f.db.materialOrder.findUniqueOrThrow({
          where: { id: first.order.id },
        });
        assert.equal(order.grossCredit, 2000n);
        assert.equal(order.purchasedFileSnapshot.storageKey, original);
        assert.ok(
          served(await f.catalog.download(buyer.principal, paid.id), original),
        );
        assert.equal(edited.priceCredit, "30.00");
      },
    );
    await t.test("HIDDEN blocks new purchases", async () => {
      const current = await f.db.material.findUniqueOrThrow({
        where: { id: paid.id },
      });
      await f.moderation.moderate(f.moderator.principal, paid.id, "hide", {
        expectedListingVersion: current.listingVersion,
        reason: "Copyright claim",
      });
      const late = await f.account();
      await f.fund(late, 5000n);
      await assert.rejects(
        f.purchases.purchase(
          late.principal,
          paid.id,
          current.listingVersion,
          randomUUID(),
        ),
        /MATERIAL_NOT_PUBLISHED/,
      );
    });
  } finally {
    await f.dispose();
  }
});
