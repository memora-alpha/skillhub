import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_FREE_ENTITLEMENTS,
  DEFAULT_PLAN_ENTITLEMENTS,
  includesRecording,
  parsePlanEntitlements,
} from "../../dist/modules/subscriptions/domain/plan-entitlements.js";
import {
  DAY_MS,
  allocateRecordingMinutes,
  baseFeePolicyCode,
  decideAtTermEnd,
  grantsEntitlements,
  proratedUpgradeAmount,
  raisedRetentionDays,
  recordedMinutes,
  termEndFor,
  tierFeePolicyCode,
  usagePeriod,
} from "../../dist/modules/subscriptions/domain/subscription.policy.js";

const start = new Date("2026-12-01T00:00:00.000Z");
const at = (days) => new Date(start.getTime() + days * DAY_MS);

test("plan entitlements validate ranges and reject unknown fields", () => {
  assert.deepEqual(
    parsePlanEntitlements(DEFAULT_PLAN_ENTITLEMENTS.PRO),
    DEFAULT_PLAN_ENTITLEMENTS.PRO,
  );
  const invalid = [
    { whiteboardRetentionDays: 7 },
    { recordingRetentionDays: 0 },
    { recordingMinutesPerPeriod: -1 },
    { materialStorageBytes: "1.5" },
    { materialStorageBytes: 10 },
    { feeTier: "FREE" },
    { extra: true },
  ];
  for (const patch of invalid)
    assert.throws(
      () =>
        parsePlanEntitlements({
          ...DEFAULT_PLAN_ENTITLEMENTS.CREATOR,
          ...patch,
        }),
      undefined,
      JSON.stringify(patch),
    );
  assert.equal(includesRecording(DEFAULT_FREE_ENTITLEMENTS), false);
  assert.equal(includesRecording(DEFAULT_PLAN_ENTITLEMENTS.CREATOR), true);
});

test("terms and 30-day usage periods", () => {
  assert.deepEqual(termEndFor(start, "MONTH"), at(30));
  assert.deepEqual(termEndFor(start, "YEAR"), at(365));
  const yearEnd = at(365);
  assert.deepEqual(usagePeriod(start, yearEnd, at(0)), {
    start: at(0),
    end: at(30),
  });
  // A period boundary belongs to the next period.
  assert.deepEqual(usagePeriod(start, yearEnd, at(30)).start, at(30));
  assert.deepEqual(usagePeriod(start, yearEnd, at(59.9)).start, at(30));
  // The last YEAR period is 5 days and ends with the term.
  assert.deepEqual(usagePeriod(start, yearEnd, at(362)), {
    start: at(360),
    end: yearEnd,
  });
  // A time before the term start maps to the first period.
  assert.deepEqual(usagePeriod(start, yearEnd, at(-1)).start, start);
});

test("entitlements end with the term, or with grace", () => {
  const active = { status: "ACTIVE", termEnd: at(30), graceUntil: null };
  assert.equal(grantsEntitlements(active, at(29)), true);
  // A lapsed term without renewal grants nothing even before the job runs.
  assert.equal(grantsEntitlements(active, at(30)), false);
  const grace = { status: "GRACE", termEnd: at(30), graceUntil: at(33) };
  assert.equal(grantsEntitlements(grace, at(32)), true);
  assert.equal(grantsEntitlements(grace, at(33)), false);
  assert.equal(
    grantsEntitlements(
      { status: "EXPIRED", termEnd: at(30), graceUntil: null },
      at(1),
    ),
    false,
  );
});

test("prorated upgrade is floored and bounded by the term", () => {
  const input = {
    currentPrice: 9_900n,
    targetPrice: 29_900n,
    termStart: start,
    termEnd: at(30),
  };
  assert.equal(proratedUpgradeAmount({ ...input, at: start }), 20_000n);
  assert.equal(proratedUpgradeAmount({ ...input, at: at(15) }), 10_000n);
  // 20000 * 1/3 = 6666.66… → floored.
  assert.equal(proratedUpgradeAmount({ ...input, at: at(20) }), 6_666n);
  assert.equal(proratedUpgradeAmount({ ...input, at: at(31) }), 0n);
  assert.equal(proratedUpgradeAmount({ ...input, at: at(-5) }), 20_000n);
  assert.throws(() =>
    proratedUpgradeAmount({ ...input, targetPrice: 9_900n, at: start }),
  );
});

test("term end decisions follow auto-renew, payment and grace", () => {
  const base = {
    status: "ACTIVE",
    autoRenew: true,
    canPay: true,
    termEnd: at(30),
    graceUntil: null,
    graceDays: 3,
  };
  assert.deepEqual(decideAtTermEnd({ ...base, at: at(29) }), {
    action: "WAIT",
  });
  assert.deepEqual(decideAtTermEnd({ ...base, at: at(30) }), {
    action: "RENEW",
  });
  assert.deepEqual(decideAtTermEnd({ ...base, autoRenew: false, at: at(30) }), {
    action: "EXPIRE",
  });
  assert.deepEqual(decideAtTermEnd({ ...base, canPay: false, at: at(30) }), {
    action: "ENTER_GRACE",
    graceUntil: at(33),
  });
  assert.deepEqual(
    decideAtTermEnd({ ...base, canPay: false, graceDays: 0, at: at(30) }),
    { action: "EXPIRE" },
  );
  const grace = { ...base, status: "GRACE", canPay: false, graceUntil: at(33) };
  assert.deepEqual(decideAtTermEnd({ ...grace, at: at(31) }), {
    action: "WAIT",
  });
  assert.deepEqual(decideAtTermEnd({ ...grace, at: at(33) }), {
    action: "EXPIRE",
  });
  assert.deepEqual(decideAtTermEnd({ ...grace, canPay: true, at: at(32) }), {
    action: "RENEW",
  });
  assert.deepEqual(
    decideAtTermEnd({ ...base, status: "EXPIRED", at: at(40) }),
    {
      action: "WAIT",
    },
  );
});

test("recording minutes round up and spend allowance before add-on", () => {
  assert.equal(recordedMinutes(0n), 0);
  assert.equal(recordedMinutes(1n), 1);
  assert.equal(recordedMinutes(60_000n), 1);
  assert.equal(recordedMinutes(60_001), 2);
  assert.equal(recordedMinutes(-5), 0);
  assert.deepEqual(
    allocateRecordingMinutes({
      minutes: 50,
      allowed: 120,
      used: 100,
      addonRemaining: 60,
    }),
    { fromAllowance: 20, fromAddon: 30, absorbed: 0 },
  );
  // Overrun beyond allowance and add-on is absorbed, never negative.
  assert.deepEqual(
    allocateRecordingMinutes({
      minutes: 90,
      allowed: 120,
      used: 110,
      addonRemaining: 20,
    }),
    { fromAllowance: 10, fromAddon: 20, absorbed: 60 },
  );
  assert.deepEqual(
    allocateRecordingMinutes({
      minutes: 10,
      allowed: 120,
      used: 130,
      addonRemaining: 0,
    }),
    { fromAllowance: 0, fromAddon: 0, absorbed: 10 },
  );
});

test("fee policy codes map tiers and never tier TWO_WAY", () => {
  assert.equal(tierFeePolicyCode("ONE_WAY", "PRO"), "ONE_WAY_PRO");
  assert.equal(
    tierFeePolicyCode("MATERIAL_PAID", "CREATOR"),
    "MATERIAL_PAID_CREATOR",
  );
  assert.equal(tierFeePolicyCode("ONE_WAY", null), "ONE_WAY");
  assert.equal(tierFeePolicyCode("TWO_WAY", "PRO"), "TWO_WAY");
  assert.equal(baseFeePolicyCode("ONE_WAY_PRO"), "ONE_WAY");
  assert.equal(baseFeePolicyCode("MATERIAL_PAID_CREATOR"), "MATERIAL_PAID");
  assert.equal(baseFeePolicyCode("TWO_WAY"), "TWO_WAY");
  assert.equal(baseFeePolicyCode("ONE_WAY_PROMO"), "ONE_WAY_PROMO");
});

test("whiteboard retention snapshot only grows", () => {
  assert.equal(raisedRetentionDays(null, [30, 365]), 365);
  assert.equal(raisedRetentionDays(365, [30, 30]), 365);
  assert.equal(raisedRetentionDays(30, [180]), 180);
});
