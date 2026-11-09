import assert from "node:assert/strict";
import test from "node:test";
import {
  createCommunityApi,
  type Reputation,
} from "../src/features/community/api/community-api";
import { AppError } from "../src/lib/http/errors";
import {
  hasRequestRestriction,
  restrictionDeadline,
} from "../src/features/community/utils/reputation-policy";
import { fixtureId } from "./fixtures/learning-requests-data";

export const reputationSnapshot = () =>
  ({
    reputationScore: 25,
    level: "LOW",
    activeRestrictions: [
      {
        scope: "CREATE_NEW_ACTIVITY",
        reasonCode: "LOW_REPUTATION",
        endsAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    policyNotice: ["Xác nhận trung thực việc tham gia và hoàn thành buổi học."],
    restrictionReviews: [
      {
        id: fixtureId(5),
        scope: "REQUIRE_STAFF_REVIEW",
        endsAt: "2026-01-01T00:00:00.000Z",
        decision: "APPROVED",
        reviewedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    items: [],
    nextCursor: null,
  }) satisfies Reputation;

test("reputation keeps server policy and review results; legacy omission stays distinguishable from no policy", async () => {
  const raw = reputationSnapshot();
  const api = createCommunityApi(async () => raw, fixtureId(1));
  const data = await api.reputation();
  assert.deepEqual(data.policyNotice, raw.policyNotice);
  assert.equal(data.restrictionReviews?.[0]?.decision, "APPROVED");
  const legacy = Object.fromEntries(
    Object.entries(raw).filter(
      ([key]) => !["policyNotice", "restrictionReviews"].includes(key),
    ),
  );
  const old = await createCommunityApi(
    async () => legacy,
    fixtureId(1),
  ).reputation();
  assert.equal(old.policyNotice, undefined);
  assert.equal(
    (
      await createCommunityApi(
        async () => ({ ...raw, policyNotice: null }),
        fixtureId(1),
      ).reputation()
    ).policyNotice,
    null,
  );
});

test("invalid policy or review projections fail instead of enabling confirmation", async () => {
  for (const replacement of [
    { policyNotice: [] },
    { policyNotice: [""] },
    { policyNotice: "read this" },
    {
      restrictionReviews: [
        { ...reputationSnapshot().restrictionReviews[0], decision: "UNKNOWN" },
      ],
    },
  ]) {
    await assert.rejects(
      () =>
        createCommunityApi(
          async () => ({ ...reputationSnapshot(), ...replacement }),
          fixtureId(1),
        ).reputation(),
      AppError,
    );
  }
});

test("policy acknowledgement uses the existing endpoint, disables renewal replay and validates the receipt", async () => {
  const calls: unknown[] = [];
  const api = createCommunityApi(async (path, options) => {
    calls.push({ path, options });
    return { acknowledged: true };
  }, fixtureId(1));
  assert.deepEqual(await api.acknowledgePolicy(), { acknowledged: true });
  assert.deepEqual(calls, [
    {
      path: "/reputation/restrictions/policy-acknowledgement",
      options: { method: "POST", replayAfterRenewal: false },
    },
  ]);
  for (const invalid of [{ acknowledged: false }, {}, null])
    await assert.rejects(
      () =>
        createCommunityApi(
          async () => invalid,
          fixtureId(1),
        ).acknowledgePolicy(),
      AppError,
    );
  await assert.rejects(
    () =>
      createCommunityApi(async () => {
        throw Error("must not send");
      }, "").acknowledgePolicy(),
    AppError,
  );
});

test("expired dates never unlock a server restriction or imply it expired without missing conditions", () => {
  const data = reputationSnapshot();
  assert.equal(hasRequestRestriction(data), true);
  assert.match(
    restrictionDeadline(data.activeRestrictions[0]!.endsAt, true),
    /Thời hạn đã qua.*cần xác nhận/,
  );
  assert.match(
    restrictionDeadline(data.activeRestrictions[0]!.endsAt, false),
    /hệ thống vẫn ghi nhận hạn chế/,
  );
  assert.match(
    restrictionDeadline("2099-01-01T00:00:00.000Z", false),
    /Hạn chế đến/,
  );
  assert.equal(
    hasRequestRestriction({
      ...data,
      activeRestrictions: [
        { ...data.activeRestrictions[0]!, scope: "REQUIRE_STAFF_REVIEW" },
      ],
    }),
    false,
  );
});
