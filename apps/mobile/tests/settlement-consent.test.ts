import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../src/lib/http/errors";
import { createPathChangesApi } from "../src/features/learning-paths/api/path-changes-api";
import {
  canConsentToSettlement,
  submitSettlementConsent,
} from "../src/features/learning-paths/utils/settlement-consent";
import { settlementFixture } from "./fixtures/path-changes-data";
import { fixtureId } from "./fixtures/learning-requests-data";

const snapshot = () => ({
  ...settlementFixture("WAITING_DISPUTE_WINDOW"),
  pathVersion: 3,
  autoSettlementAt: "2030-01-03T00:00:00Z",
  immediateSettlement: {
    ownApprovedAt: null,
    partnerApprovedAt: null,
    canApprove: true,
  },
});
const receipt = (outcome = "WAITING") => ({
  pathId: fixtureId(10),
  approvedAt: "2030-01-01T00:00:00Z",
  bothApproved: false,
  settlement: { outcome },
});

test("new settlement projection preserves server consent, version and UTC deadline; legacy data cannot authorize consent", async () => {
  const api = createPathChangesApi(async () => snapshot());
  assert.deepEqual(await api.settlement(fixtureId(10)), snapshot());
  assert.equal(canConsentToSettlement(snapshot()), true);
  assert.equal(
    canConsentToSettlement(settlementFixture("WAITING_DISPUTE_WINDOW")),
    false,
  );
  assert.equal(
    canConsentToSettlement({ ...snapshot(), pathVersion: null }),
    false,
  );
  for (const status of [
    "SETTLED",
    "TERMINATED",
    "WAITING_DISPUTE",
    "WAITING_TERMINATION",
    "WAITING_SESSIONS",
  ] as const)
    assert.equal(canConsentToSettlement({ ...snapshot(), status }), false);
});
test("explicit consent first rechecks status, posts locked version without an invented idempotency header, and retains WAITING", async () => {
  const calls: {
    url: string;
    method?: string;
    body?: unknown;
    replay?: boolean;
    key?: string;
  }[] = [];
  const api = createPathChangesApi(async (url, options) => {
    calls.push({
      url,
      method: options?.method,
      body: options?.body,
      replay: options?.replayAfterRenewal,
      key: options?.idempotencyKey,
    });
    return options?.method === "POST" ? receipt() : snapshot();
  });
  const result = await submitSettlementConsent(api, snapshot());
  assert.equal(result.kind, "submitted");
  if (result.kind === "submitted")
    assert.equal(result.receipt.settlement.outcome, "WAITING");
  assert.deepEqual(
    calls.map((c) => c.url),
    [
      `/learning-paths/${fixtureId(10)}/settlement-status`,
      `/sessions/paths/${fixtureId(10)}/settlement-consent`,
    ],
  );
  assert.deepEqual(calls[1]?.body, { expectedVersion: 3 });
  assert.equal(calls[1]?.replay, false);
  assert.equal(calls[1]?.key, undefined);
});
test("fresh dispute, termination, disabled approval or changed version prevents the financial decision POST", async () => {
  for (const fresh of [
    { ...snapshot(), status: "WAITING_DISPUTE" },
    { ...snapshot(), status: "WAITING_TERMINATION" },
    { ...snapshot(), pathVersion: 4 },
    {
      ...snapshot(),
      immediateSettlement: {
        ...snapshot().immediateSettlement,
        canApprove: false,
      },
    },
  ]) {
    let posts = 0;
    const api = createPathChangesApi(async (_url, options) => {
      if (options?.method === "POST") posts++;
      return fresh;
    });
    await assert.rejects(submitSettlementConsent(api, snapshot()), {
      status: 409,
    });
    assert.equal(posts, 0);
  }
});
test("uncertain explicit retry reads an already-recorded consent instead of posting again", async () => {
  let posted = false,
    posts = 0;
  const api = createPathChangesApi(async (_url, options) => {
    if (options?.method === "POST") {
      posts++;
      posted = true;
      throw new AppError("network");
    }
    return {
      ...snapshot(),
      immediateSettlement: {
        ...snapshot().immediateSettlement,
        ownApprovedAt: posted ? "2030-01-01T00:00:00Z" : null,
        canApprove: !posted,
      },
    };
  });
  await assert.rejects(submitSettlementConsent(api, snapshot()));
  assert.deepEqual(await submitSettlementConsent(api, snapshot()), {
    kind: "observed",
  });
  assert.equal(posts, 1);
});
test("SETTLED is read-only, and a status read never grants consent", async () => {
  let posts = 0;
  const api = createPathChangesApi(async (_url, options) => {
    if (options?.method === "POST") posts++;
    return {
      ...snapshot(),
      status: "SETTLED",
      settledAt: "2030-01-01T00:00:00Z",
    };
  });
  await api.settlement(fixtureId(10));
  assert.deepEqual(await submitSettlementConsent(api, snapshot()), {
    kind: "observed",
  });
  assert.equal(posts, 0);
});
test("200 RETRYING/NEEDS_REVIEW preserve the consent receipt without asserting financial success", async () => {
  for (const outcome of ["RETRYING", "NEEDS_REVIEW"]) {
    const api = createPathChangesApi(async (_url, options) =>
      options?.method === "POST" ? receipt(outcome) : snapshot(),
    );
    const result = await submitSettlementConsent(api, snapshot());
    assert.equal(result.kind, "submitted");
    if (result.kind === "submitted") {
      assert.equal(result.receipt.settlement.outcome, outcome);
      assert.equal(result.receipt.bothApproved, false);
    }
  }
});
test("malformed/cross-path consent responses and invalid versions fail closed", async () => {
  for (const payload of [
    { ...receipt(), pathId: fixtureId(999) },
    { ...receipt(), settlement: { outcome: "PAID" } },
    { ...receipt(), approvedAt: "bad" },
  ]) {
    const api = createPathChangesApi(async () => payload);
    await assert.rejects(api.approveSettlement(fixtureId(10), 3), {
      kind: "protocol",
    });
  }
  let calls = 0;
  const api = createPathChangesApi(async () => {
    calls++;
    return receipt();
  });
  await assert.rejects(api.approveSettlement(fixtureId(10), 0));
  assert.equal(calls, 0);
});
