import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createMaterialFixture } from "./fixture.mjs";

test("material review lifecycle on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const owner = await f.account();
    const reviewer = await f.account();
    const reporter = await f.account();
    const admin = await f.account("ADMIN");
    const material = await f.publishedMaterial(owner);

    await t.test(
      "FREE review requires a successful backend download",
      async () => {
        assert.equal(
          (await f.reviews.eligibility(reviewer.principal, material.id))
            .reasonCode,
          "MATERIAL_ACCESS_REQUIRED",
        );
        assert.equal(
          (await f.reviews.eligibility(owner.principal, material.id))
            .reasonCode,
          "MATERIAL_OWNER_CANNOT_REVIEW",
        );
        await f.catalog.download(reviewer.principal, material.id);
        assert.equal(
          (await f.reviews.eligibility(reviewer.principal, material.id))
            .canReview,
          true,
        );
      },
    );

    let review;
    await t.test(
      "create is replay-safe and updates the visible summary",
      async () => {
        const first = await f.reviews.create(
          reviewer.principal,
          material.id,
          { rating: 5, comment: "  Excellent reference  " },
          "review-create",
        );
        const replay = await f.reviews.create(
          reviewer.principal,
          material.id,
          { rating: 5, comment: "  Excellent reference  " },
          "review-create",
        );
        review = first.review;
        assert.equal(first.replayed, false);
        assert.equal(replay.replayed, true);
        assert.equal(replay.review.id, review.id);
        assert.equal(review.comment, "Excellent reference");
        const page = await f.reviews.list(material.id, { limit: 20 });
        assert.equal(page.data.length, 1);
        assert.equal(page.summary.average, "5.00");
        assert.equal(page.summary.stars[5], 1);
      },
    );

    await t.test(
      "versioned update and soft-delete allow recreation",
      async () => {
        const updated = await f.reviews.update(reviewer.principal, review.id, {
          expectedVersion: review.version,
          rating: 3,
          comment: "Useful, with a few gaps",
        });
        await assert.rejects(
          f.reviews.update(reviewer.principal, review.id, {
            expectedVersion: review.version,
            rating: 4,
          }),
          /MATERIAL_REVIEW_VERSION_CONFLICT/,
        );
        await f.reviews.remove(reviewer.principal, review.id, updated.version);
        assert.equal((await f.reviews.list(material.id, {})).summary.total, 0);
        const recreated = await f.reviews.create(
          reviewer.principal,
          material.id,
          { rating: 4 },
          "review-recreate",
        );
        assert.notEqual(recreated.review.id, review.id);
        review = recreated.review;
      },
    );

    await t.test(
      "report, hide and restore stay separate and update summary",
      async () => {
        await f.reviews.report(reporter.principal, review.id, {
          reasonCode: "HARASSMENT",
          description: "This review contains abusive wording.",
        });
        const queue = await f.reviewModeration.queue(
          admin.principal,
          "REPORTED",
          { limit: 20 },
        );
        assert.equal(queue.data[0].id, review.id);
        const hidden = await f.reviewModeration.moderate(
          admin.principal,
          review.id,
          "hide",
          {
            expectedVersion: review.version,
            reason: "Abusive content confirmed",
          },
        );
        assert.equal((await f.reviews.list(material.id, {})).summary.total, 0);
        const restored = await f.reviewModeration.moderate(
          admin.principal,
          review.id,
          "restore",
          { expectedVersion: hidden.version, reason: "Appeal accepted" },
        );
        assert.equal(restored.status, "VISIBLE");
        assert.equal((await f.reviews.list(material.id, {})).summary.total, 1);
        assert.equal(
          await f.db.materialReviewReport.count({ where: { status: "OPEN" } }),
          0,
        );
      },
    );

    await t.test(
      "refund changes verifiedPurchase and blocks recreation until repurchase",
      async () => {
        const paidReviewer = await f.account();
        await f.fund(paidReviewer, 5000n);
        const paid = await f.publishedMaterial(owner, {
          title: "Paid review eligibility material",
          accessType: "PAID",
          priceCredit: "10",
        });
        const purchase = await f.purchases.purchase(
          paidReviewer.principal,
          paid.id,
          paid.listingVersion,
          randomUUID(),
        );
        const created = await f.reviews.create(
          paidReviewer.principal,
          paid.id,
          { rating: 5 },
          "paid-review",
        );
        assert.equal(
          (await f.reviews.list(paid.id, {})).data[0].verifiedPurchase,
          true,
        );
        await f.purchases.refund(paidReviewer.principal, purchase.order.id);
        assert.equal(
          (await f.reviews.list(paid.id, {})).data[0].verifiedPurchase,
          false,
        );
        await f.reviews.remove(
          paidReviewer.principal,
          created.review.id,
          created.review.version,
        );
        assert.equal(
          (await f.reviews.eligibility(paidReviewer.principal, paid.id))
            .reasonCode,
          "MATERIAL_ENTITLEMENT_REVOKED",
        );
        await f.purchases.purchase(
          paidReviewer.principal,
          paid.id,
          paid.listingVersion,
          randomUUID(),
        );
        assert.equal(
          (await f.reviews.eligibility(paidReviewer.principal, paid.id))
            .canReview,
          true,
        );
      },
    );
  } finally {
    await f.dispose();
  }
});
