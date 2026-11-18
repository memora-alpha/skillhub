import assert from "node:assert/strict";
import { test } from "node:test";
import { createMaterialFixture } from "./fixture.mjs";

test("saved materials and buyer order projections on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const seller = await f.account();
    const buyer = await f.account();
    await f.fund(buyer, 5000n);
    let paid = await f.publishedMaterial(seller, {
      title: "Historical Kubernetes handbook",
      accessType: "PAID",
      priceCredit: "20",
    });

    await t.test(
      "save is idempotent, paginated, and remove is replay-safe",
      async () => {
        const first = await f.favorites.add(buyer.principal, paid.id);
        const replay = await f.favorites.add(buyer.principal, paid.id);
        assert.equal(first.replayed, false);
        assert.equal(replay.replayed, true);
        assert.equal(replay.favorite.id, first.favorite.id);
        const page = await f.favorites.list(buyer.principal, { limit: 20 });
        assert.equal(page.data.length, 1);
        assert.equal(page.data[0].material.id, paid.id);
        assert.equal(
          page.data[0].material.title,
          "Historical Kubernetes handbook",
        );
        assert.deepEqual(page.data[0].material.thumbnail, {
          kind: "PLACEHOLDER",
          format: "PDF",
        });
        assert.equal(
          (await f.favorites.remove(buyer.principal, paid.id)).removed,
          true,
        );
        assert.equal(
          (await f.favorites.remove(buyer.principal, paid.id)).removed,
          false,
        );
      },
    );

    await t.test(
      "hidden saved materials do not leak through the saved list",
      async () => {
        await f.favorites.add(buyer.principal, paid.id);
        await f.moderation.moderate(f.moderator.principal, paid.id, "hide", {
          expectedListingVersion: paid.listingVersion,
          reason: "Safety review",
        });
        const page = await f.favorites.list(buyer.principal, {});
        assert.equal(page.data.length, 0);
        paid = await f.moderation.moderate(
          f.moderator.principal,
          paid.id,
          "unhide",
          {
            expectedListingVersion: paid.listingVersion + 1,
            reason: "Safety review cleared",
          },
        );
      },
    );

    await t.test(
      "order list uses purchase-time metadata and exposes review/refund policy",
      async () => {
        const purchase = await f.purchases.purchase(
          buyer.principal,
          paid.id,
          paid.listingVersion,
          "projection-order",
        );
        await f.db.material.update({
          where: { id: paid.id },
          data: { title: "Renamed after purchase" },
        });
        const page = await f.purchases.listOrders(buyer.principal, {});
        const order = page.data.find((entry) => entry.id === purchase.order.id);
        assert.ok(order);
        assert.equal(
          order.purchasedMaterial.title,
          "Historical Kubernetes handbook",
        );
        assert.equal(order.purchasedMaterial.originalFilename, "notes.pdf");
        assert.equal(order.purchasedMaterial.mimeType, "application/pdf");
        assert.equal(order.review.hasReview, false);
        assert.equal(order.review.canReview, true);
        assert.equal(order.refundEligibility.canRefund, true);
        assert.equal(order.refundEligibility.reasonCode, null);
        assert.ok(order.refundEligibility.deadline instanceof Date);
        assert.ok(order.refundEligibility.evaluatedAt instanceof Date);
      },
    );
  } finally {
    await f.dispose();
  }
});
