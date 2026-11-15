import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ratingSummaryView,
  reviewComment,
  reviewRating,
} from "../../dist/modules/materials/domain/material-review.policy.js";

test("material review input policy normalizes comments and ratings", () => {
  assert.equal(reviewRating(1), 1);
  assert.equal(reviewRating(5), 5);
  assert.throws(() => reviewRating(0), /MATERIAL_REVIEW_RATING_INVALID/);
  assert.throws(() => reviewRating(3.5), /MATERIAL_REVIEW_RATING_INVALID/);
  assert.equal(reviewComment("  useful  "), "useful");
  assert.equal(reviewComment("   "), null);
  assert.equal(reviewComment(null), null);
  assert.throws(
    () => reviewComment("x".repeat(2001)),
    /MATERIAL_REVIEW_COMMENT_INVALID/,
  );
});

test("rating summary is decimal text and has stable zero shape", () => {
  assert.deepEqual(ratingSummaryView(null), {
    average: null,
    total: 0,
    stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  assert.deepEqual(
    ratingSummaryView({
      visibleCount: 3,
      star1: 0,
      star2: 1,
      star3: 0,
      star4: 1,
      star5: 1,
      ratingSum: 11,
    }),
    {
      average: "3.67",
      total: 3,
      stars: { 1: 0, 2: 1, 3: 0, 4: 1, 5: 1 },
    },
  );
});
