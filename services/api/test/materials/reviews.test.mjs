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
        await f.reviews.report(reporter.principal, review.id, {
          reasonCode: "OTHER",
          description: "This report is intentionally rejected by moderation.",
        });
        const dismissed = await f.reviewModeration.dismissReports(
          admin.principal,
          review.id,
          {
            expectedVersion: restored.version,
            reason: "Review is valid and the report is unfounded",
          },
        );
        assert.equal(dismissed.resolvedReportCount, 1);
        assert.equal(dismissed.reviewStatus, "VISIBLE");
        assert.equal((await f.reviews.list(material.id, {})).summary.total, 1);
        assert.equal(
          await f.db.materialReviewReport.count({ where: { status: "OPEN" } }),
          0,
        );
      },
    );

    await t.test(
      "deleting a reported review closes its open reports",
      async () => {
        const deletingAuthor = await f.account();
        const deletingReporter = await f.account();
        await f.catalog.download(deletingAuthor.principal, material.id);
        const created = await f.reviews.create(
          deletingAuthor.principal,
          material.id,
          { rating: 2, comment: "Will be deleted" },
          "reported-delete",
        );
        await f.reviews.report(deletingReporter.principal, created.review.id, {
          reasonCode: "OTHER",
          description: "Open report before the author removes the review.",
        });
        await f.reviews.remove(
          deletingAuthor.principal,
          created.review.id,
          created.review.version,
        );
        assert.equal(
          await f.db.materialReviewReport.count({
            where: { reviewId: created.review.id, status: "OPEN" },
          }),
          0,
        );
        const queue = await f.reviewModeration.queue(
          admin.principal,
          "REPORTED",
          {},
        );
        assert.equal(
          queue.data.some((item) => item.id === created.review.id),
          false,
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
        const editable = await f.reviews.eligibility(
          paidReviewer.principal,
          paid.id,
        );
        assert.equal(editable.canEdit, true);
        assert.equal(editable.editReasonCode, null);
        assert.equal(
          (await f.reviews.list(paid.id, {})).data[0].verifiedPurchase,
          true,
        );
        await f.purchases.refund(paidReviewer.principal, purchase.order.id);
        const locked = await f.reviews.eligibility(
          paidReviewer.principal,
          paid.id,
        );
        assert.equal(locked.canEdit, false);
        assert.equal(locked.editReasonCode, "MATERIAL_ENTITLEMENT_REVOKED");
        assert.equal(
          (await f.reviews.list(paid.id, {})).data[0].verifiedPurchase,
          false,
        );
        await assert.rejects(
          f.reviews.update(paidReviewer.principal, created.review.id, {
            expectedVersion: created.review.version,
            rating: 4,
          }),
          /MATERIAL_REVIEW_NOT_ALLOWED/,
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
