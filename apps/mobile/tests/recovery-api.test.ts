import assert from "node:assert/strict";
import { test } from "node:test";
import { createRecoveryApi } from "../src/features/community/api/recovery-api";
import { AppError } from "../src/lib/http/errors";
import {
  reputationReasons,
  reputationTone,
  matchingRestrictionReview,
} from "../src/features/community/utils/reputation-presentation";
import type { Reputation } from "../src/features/community/api/community-api";

test("recovery retains backend eligibility, policy, progress and budget, including an ineligible account", async () => {
  const payload = {
    eligible: true,
    remainingBudget: 3,
    missions: [
      {
        code: "COMMITMENT_RECOVERY",
        reward: 3,
        claimed: false,
        progress: { current: 1, target: 2, complete: false },
      },
    ],
    quiz: {
      version: "1",
      policy: ["Học tập trung thực"],
      questions: ["Có thể tạo hoạt động giả?"],
    },
  };
  const signal = new AbortController().signal;
  const api = createRecoveryApi(async (path, options) => {
    assert.equal(path, "/reputation/recovery");
    assert.equal(options?.signal, signal);
    return payload;
  });
  assert.deepEqual(await api.read(signal), payload);
  const empty = {
    eligible: false,
    remainingBudget: 0,
    missions: [],
    quiz: null,
  };
  assert.deepEqual(await createRecoveryApi(async () => empty).read(), empty);
});

test("quiz and claims send exact explicit inputs with renewal replay disabled", async () => {
  const calls: unknown[] = [];
  const api = createRecoveryApi(async (path, options) => {
    calls.push([path, options]);
    return { passed: true, awarded: 2 };
  });
  await api.quiz("1", [true, false]);
  await api.claim("GOOD_BEHAVIOR_STREAK");
  assert.deepEqual(calls, [
    [
      "/reputation/recovery/quiz",
      {
        method: "POST",
        body: { version: "1", answers: [true, false] },
        replayAfterRenewal: false,
      },
    ],
    [
      "/reputation/recovery/claim",
      {
        method: "POST",
        body: { code: "GOOD_BEHAVIOR_STREAK" },
        replayAfterRenewal: false,
      },
    ],
  ]);
  const count = calls.length;
  assert.throws(() => api.claim("POLICY_AWARENESS"));
  assert.throws(() => api.quiz("1", []));
  assert.equal(calls.length, count);
});

test("malformed recovery rewards are rejected and uncertain network errors are preserved", async () => {
  await assert.rejects(
    createRecoveryApi(async () => ({ passed: true, awarded: -2 })).claim(
      "COMMITMENT_RECOVERY",
    ),
    (error) => error instanceof AppError && error.kind === "protocol",
  );
  const error = new AppError("network");
  await assert.rejects(
    createRecoveryApi(async () => {
      throw error;
    }).quiz("1", [false]),
    (failure) => failure === error,
  );
});

test("server warning stays warning without a lock and historical review metadata only merges into its matching restriction", () => {
  assert.equal(reputationTone("WARNING"), "warning");
  assert.equal(reputationTone("future-level"), "muted");
  assert.match(reputationReasons.PENALTY_REVERSED!, /Hoàn lại/);
  assert.match(reputationReasons.RECOVERY_REWARD_REVOKED!, /Thu hồi/);
  assert.match(reputationReasons.QA_ADMIN_ADJUSTMENT!, /quản trị viên/);
  const review = {
    id: "review",
    scope: "REQUIRE_STAFF_REVIEW" as const,
    endsAt: "2026-11-20T00:00:00Z",
    decision: "APPROVED" as const,
    reviewedAt: "2026-11-13T00:00:00Z",
  };
  const data: Reputation = {
    reputationScore: 15,
    level: "SEVERE",
    activeRestrictions: [],
    restrictionReviews: [review],
    items: [],
    nextCursor: null,
  };
  assert.equal(
    matchingRestrictionReview(data, review.scope, review.endsAt),
    review,
  );
  assert.equal(
    matchingRestrictionReview(data, review.scope, "2026-11-21T00:00:00Z"),
    undefined,
  );
  assert.equal(
    matchingRestrictionReview(data, "REQUIRE_ADMIN_REVIEW", review.endsAt),
    undefined,
  );
});
