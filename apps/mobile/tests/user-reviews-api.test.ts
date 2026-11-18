import assert from "node:assert/strict";
import { test } from "node:test";
import { createUserReviewsApi } from "../src/features/community/api/user-reviews-api";
import { fixtureId } from "./fixtures/learning-requests-data";
import { AppError } from "../src/lib/http/errors";

function response(empty = false) {
  return {
    data: {
      items: empty
        ? []
        : [
            {
              id: fixtureId(4),
              rating: 5,
              comment: "Rất hữu ích",
              createdAt: "2026-11-13T08:00:00Z",
              reviewer: null,
              reviewee: { userId: fixtureId(2), displayName: "Người dạy" },
            },
          ],
      summary: {
        reviewCount: empty ? 0 : 30,
        averageRating: empty ? null : 4.7,
        ratingDistribution: { "5": empty ? 0 : 21, "4": empty ? 0 : 9 },
      },
    },
    meta: { pagination: { nextCursor: empty ? null : "cursor-next-page" } },
  };
}

test("own sent history uses the sent endpoint scope and preserves received totals independently of page length", async () => {
  const signal = new AbortController().signal;
  const api = createUserReviewsApi(async (path, options) => {
    const url = new URL(path, "https://fixture.invalid");
    assert.equal(url.pathname, "/me/reviews");
    assert.equal(url.searchParams.get("direction"), "sent");
    assert.equal(url.searchParams.get("cursor"), "cursor-from-server");
    assert.equal(options?.signal, signal);
    assert.equal(options?.includeMeta, true);
    return response();
  });
  const result = await api.list(
    fixtureId(1),
    true,
    "sent",
    "cursor-from-server",
    signal,
  );
  assert.equal(result.items[0]?.reviewee?.displayName, "Người dạy");
  assert.equal(result.items[0]?.reviewer, null);
  assert.equal(result.summary.reviewCount, 30);
  assert.equal(result.items.length, 1);
  assert.equal(result.nextCursor, "cursor-next-page");
});

test("public history reads the target profile and cannot request another person's sent history", async () => {
  const api = createUserReviewsApi(async (path) => {
    const url = new URL(path, "https://fixture.invalid");
    assert.equal(url.pathname, `/profiles/${fixtureId(2)}/reviews`);
    assert.equal(url.searchParams.has("direction"), false);
    return response(true);
  });
  const result = await api.list(fixtureId(2), false, "sent");
  assert.equal(result.summary.averageRating, null);
  assert.equal(result.nextCursor, null);
});

test("invalid ratings or totals fail validation rather than showing misleading review statistics", async () => {
  for (const field of ["rating", "count", "average"] as const) {
    const body = response();
    if (field === "rating") body.data.items[0]!.rating = 6;
    if (field === "count") body.data.summary.reviewCount = -1;
    if (field === "average") body.data.summary.averageRating = 9;
    const api = createUserReviewsApi(async () => body);
    await assert.rejects(
      api.list(fixtureId(1), true, "received"),
      (error) => error instanceof AppError && error.kind === "protocol",
    );
  }
});

test("invalid identity is rejected before HTTP and denied reads remain errors", async () => {
  let calls = 0;
  const denied = new AppError("http", 403);
  const api = createUserReviewsApi(async () => {
    calls++;
    throw denied;
  });
  await assert.rejects(api.list("invalid", true, "received"));
  assert.equal(calls, 0);
  await assert.rejects(
    api.list(fixtureId(1), true, "received"),
    (error) => error === denied,
  );
});
