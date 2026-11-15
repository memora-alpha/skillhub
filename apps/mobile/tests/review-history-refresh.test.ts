import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { QueryClient } from "@tanstack/react-query";
import { fixtureId } from "./fixtures/learning-requests-data";
import { AppError } from "../src/lib/http/errors";

test("successful reviews refresh only the current session's histories; duplicates and late session results do not write", async () => {
  const local = createRequire(
    new URL(
      "../src/features/community/hooks/use-review-submission.ts",
      import.meta.url,
    ),
  );
  const cache = new QueryClient();
  const userId = fixtureId(1),
    counterpartId = fixtureId(2),
    pathId = fixtureId(3);
  let current = true;
  let posts = 0;
  let failure: unknown;
  let complete!: (value: unknown) => void;
  const runtime = {
    userId,
    key: ["connections", userId, 1],
    isCurrent: () => current,
  };
  const api = {
    submit: async () => {
      posts++;
      if (failure) throw failure;
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
  };
  const saved = {
    id: fixtureId(4),
    pathId,
    reviewerId: userId,
    revieweeId: counterpartId,
    rating: 5,
    comment: null,
    createdAt: "2026-11-13T08:00:00Z",
    hiddenAt: null,
  };
  const contexts = Object.entries({
    react: {
      useMemo: (fn: () => unknown) => fn(),
      useState: () => [undefined, () => {}],
    },
    "@tanstack/react-query": { useQueryClient: () => cache },
    "@/features/connections": { useConnections: () => runtime },
    "./use-community": {
      useCommunityApi: () => api,
      usePathReviews: () => ({
        data: [],
        isFetching: false,
        denied: false,
        error: null,
        refetch: async () => ({ isSuccess: true, data: [saved] }),
      }),
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const filename = local.resolve("./use-review-submission.ts");
  try {
    delete local.cache[filename];
    const { useReviewSubmission } = local(
      filename,
    ) as typeof import("../src/features/community/hooks/use-review-submission");
    const sent = [...runtime.key, "profile-reviews", userId, "own", "sent"];
    const received = [
      ...runtime.key,
      "profile-reviews",
      userId,
      "own",
      "received",
    ];
    const otherSession = [
      "connections",
      userId,
      2,
      "profile-reviews",
      userId,
      "own",
      "sent",
    ];
    const publicProfile = ["public-profile", userId, 1, counterpartId];
    const otherProfile = ["public-profile", userId, 2, counterpartId];
    const unrelatedProfile = ["public-profile", userId, 1, fixtureId(8)];
    for (const key of [
      sent,
      received,
      otherSession,
      publicProfile,
      otherProfile,
      unrelatedProfile,
    ])
      cache.setQueryData(key, { pages: [] });
    const hook = useReviewSubmission(pathId, counterpartId);
    const sending = hook.send({ rating: 5 });
    await hook.send({ rating: 4 });
    assert.equal(posts, 1);
    complete(saved);
    await sending;
    assert.equal(cache.getQueryState(sent)?.isInvalidated, true);
    assert.equal(cache.getQueryState(received)?.isInvalidated, true);
    assert.equal(cache.getQueryState(otherSession)?.isInvalidated, false);
    assert.equal(cache.getQueryState(publicProfile)?.isInvalidated, true);

    cache.setQueryData(sent, { pages: [] });
    cache.setQueryData(publicProfile, {});
    failure = new AppError("http", 409, "REVIEW_ALREADY_SUBMITTED");
    await useReviewSubmission(pathId, counterpartId).send({ rating: 5 });
    assert.equal(cache.getQueryState(sent)?.isInvalidated, true);
    assert.equal(cache.getQueryState(publicProfile)?.isInvalidated, true);
    failure = undefined;
    assert.equal(cache.getQueryState(otherProfile)?.isInvalidated, false);
    assert.equal(cache.getQueryState(unrelatedProfile)?.isInvalidated, false);
    assert.deepEqual(
      cache.getQueryData([...runtime.key, "reviews", pathId, counterpartId]),
      [saved],
    );

    cache.setQueryData(sent, { pages: [] });
    cache.setQueryData(publicProfile, {});
    const postsBeforeRefresh = posts;
    await hook.refresh();
    assert.equal(
      posts,
      postsBeforeRefresh,
      "reconciliation reads without replaying a review",
    );
    assert.equal(cache.getQueryState(sent)?.isInvalidated, true);
    assert.equal(cache.getQueryState(publicProfile)?.isInvalidated, true);

    cache.clear();
    cache.setQueryData(otherSession, { pages: [] });
    const oldHook = useReviewSubmission(pathId, counterpartId);
    const late = oldHook.send({ rating: 5 });
    current = false;
    complete(saved);
    await late;
    assert.equal(
      cache.getQueryData([...runtime.key, "reviews", pathId, counterpartId]),
      undefined,
    );
    assert.equal(cache.getQueryState(otherSession)?.isInvalidated, false);
  } finally {
    contexts.forEach((context) => context.restore());
    delete local.cache[filename];
    cache.clear();
  }
});
