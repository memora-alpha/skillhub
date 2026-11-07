import assert from "node:assert/strict";
import { test } from "node:test";
import { createCommunityApi } from "../src/features/community/api/community-api";

const userId = "10000000-0000-4000-8000-000000000001";
const historyId = "10000000-0000-4000-8000-000000000002";
const now = "2026-11-07T00:00:00.000Z";

test("reputation accepts recovery history and a pending review after the activity lock expires", async () => {
  const api = createCommunityApi(
    async () => ({
      reputationScore: 36,
      level: "RESTRICTED",
      activeRestrictions: [],
      restrictionReviews: [
        {
          id: historyId,
          scope: "REQUIRE_ADMIN_REVIEW",
          endsAt: now,
          decision: null,
          reviewedAt: null,
        },
      ],
      items: [
        {
          id: historyId,
          userId,
          scoreBefore: 34,
          scoreAfter: 36,
          delta: 2,
          reasonCode: "RECOVERY_MISSION_REWARD",
          sourceType: "RECOVERY_MISSION",
          sourceId: userId,
          createdAt: now,
        },
      ],
      nextCursor: null,
    }),
    userId,
  );
  const state = await api.reputation();
  assert.equal(state.items[0]?.delta, 2);
  assert.equal(state.activeRestrictions.length, 0);
  assert.equal(state.restrictionReviews?.[0]?.decision, null);
});

test("a recovery quiz submits answers with their server version and reads the granted amount", async () => {
  const answers = [true, false, true, false, true];
  const api = createCommunityApi(async (path, options) => {
    assert.equal(path, "/reputation/recovery/quiz");
    assert.equal(options?.method, "POST");
    assert.deepEqual(options?.body, { version: "1", answers });
    assert.equal(options?.replayAfterRenewal, false);
    return { passed: true, awarded: 1 };
  }, userId);
  assert.deepEqual(await api.submitRecoveryQuiz("1", answers), {
    passed: true,
    awarded: 1,
  });
});
