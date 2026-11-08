import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PublicReviewsService,
  reviewBoundary,
  summarizeReviews,
} from "../dist/modules/reviews/application/services/public-reviews.service.js";

const userId = "11111111-1111-4111-8111-111111111111";
const reviewId = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
test("rating summary counts the complete dataset; no reviews means no average", () => {
  assert.equal(summarizeReviews([]).averageRating, null);
  const result = summarizeReviews([
    { rating: 5, _count: { _all: 3 } },
    { rating: 1, _count: { _all: 1 } },
  ]);
  assert.equal(result.reviewCount, 4);
  assert.equal(result.averageRating, 4);
  assert.equal(result.ratingDistribution["5"], 3);
});
test("review cursor binds target and direction and rejects invalid data", () => {
  const encoded = Buffer.from(
    JSON.stringify({
      userId,
      direction: "received",
      createdAt: "2026-11-08T00:00:00.000Z",
      id: reviewId,
    }),
  ).toString("base64url");
  assert.equal(reviewBoundary(encoded, userId, "received").id, reviewId);
  assert.throws(
    () => reviewBoundary(encoded, other, "received"),
    /INVALID_REVIEW_CURSOR/,
  );
  assert.throws(
    () => reviewBoundary(encoded, userId, "sent"),
    /INVALID_REVIEW_CURSOR/,
  );
  assert.throws(
    () => reviewBoundary("invalid", userId, "received"),
    /INVALID_REVIEW_CURSOR/,
  );
});
test("public page filters hidden reviews and excludes path/identity internals, anonymizing inactive reviewers", async () => {
  let selected;
  const service = new PublicReviewsService(
    {
      run: async (work) =>
        work({
          review: {
            findMany: async (query) => {
              selected = query;
              return [
                {
                  id: reviewId,
                  rating: 1,
                  comment: "Valid negative review",
                  createdAt: new Date(),
                  reviewerIdRecord: {
                    id: other,
                    fullName: "Private",
                    accountStatus: "DEACTIVATED",
                  },
                  revieweeIdRecord: {
                    id: userId,
                    fullName: "User",
                    accountStatus: "ACTIVE",
                  },
                },
              ];
            },
            groupBy: async ({ where }) => {
              assert.equal(where.hiddenAt, null);
              return [{ rating: 1, _count: { _all: 5 } }];
            },
          },
        }),
    },
    { byId: async () => ({ accountStatus: "ACTIVE" }) },
    {},
  );
  const result = await service.page(userId, { limit: 1 });
  assert.equal(selected.where.revieweeId, userId);
  assert.equal(selected.where.hiddenAt, null);
  assert.equal(result.data[0].reviewer, null);
  assert.equal(result.summary.reviewCount, 5);
  assert.equal(result.summary.averageRating, 1);
  for (const field of [
    "pathId",
    "reviewerId",
    "revieweeId",
    "hiddenAt",
    "email",
  ])
    assert.equal(field in result.data[0], false);
});
test("private/unavailable profiles do not expose review history", async () => {
  const service = new PublicReviewsService(
    { run: async (work) => work({}) },
    { byId: async () => ({ accountStatus: "LOCKED" }) },
    {},
  );
  await assert.rejects(service.page(userId, {}), /PROFILE_NOT_FOUND/);
});
