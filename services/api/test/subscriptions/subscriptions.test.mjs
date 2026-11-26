import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_FREE_ENTITLEMENTS,
  DEFAULT_PLAN_ENTITLEMENTS,
} from "../../dist/modules/subscriptions/domain/plan-entitlements.js";
import {
  DAY,
  START,
  U,
  V,
  admin,
  buy,
  rejects,
  self,
  setup,
} from "./support.mjs";

test("purchase debits the price once and activates a 30-day term", async () => {
  const ctx = setup();
  const result = await buy(ctx);
  assert.equal(result.subscription.planCode, "CREATOR");
  assert.equal(result.subscription.status, "ACTIVE");
  assert.equal(result.subscription.autoRenew, true);
  assert.equal(
    result.subscription.termEnd,
    new Date(START.getTime() + 30 * DAY).toISOString(),
  );
  assert.deepEqual(result.entitlements, DEFAULT_PLAN_ENTITLEMENTS.CREATOR);
  assert.equal(result.usage.recordingMinutesAllowed, 120);
  assert.equal(ctx.wallets()[U], 100_000n - 9_900n);
  const [charge] = ctx.db.rows("subscriptionCharge");
  assert.equal(charge.kind, "PURCHASE");
  assert.equal(charge.amount, 9_900n);
  assert.match(charge.idempotencyKey, /^[0-9a-f]{64}$/);
  const [audit] = ctx.db.rows("auditLog");
  assert.equal(audit.action, "SUBSCRIPTION_PURCHASE");
  // The owner lock is taken in the purchase transaction.
  assert.ok(ctx.db.locks.includes(`advisory:subscription-owner:${U}`));

  // Same key, same body: replayed without a second debit.
  await buy(ctx);
  assert.equal(ctx.db.rows("subscriptionCharge").length, 1);
  assert.equal(ctx.wallets()[U], 100_000n - 9_900n);
  // Same key, other body: rejected.
  await rejects(buy(ctx, "PRO"), "IDEMPOTENCY_KEY_REUSED");
});

test("year interval charges the year price for 365 days", async () => {
  const ctx = setup({ wallet: 500_000n });
  const result = await buy(ctx, "PRO", "purchase-year-1", "YEAR");
  assert.equal(
    result.subscription.termEnd,
    new Date(START.getTime() + 365 * DAY).toISOString(),
  );
  assert.equal(ctx.wallets()[U], 500_000n - 287_000n);
});

test("purchase refusals leave the wallet and tables untouched", async () => {
  const poor = setup({ wallet: 5_000n });
  await rejects(buy(poor), "INSUFFICIENT_AVAILABLE_CREDIT");
  assert.equal(poor.db.rows("userSubscription").length, 0);
  assert.equal(poor.wallets()[U], 5_000n);

  const ctx = setup();
  await rejects(
    ctx.service.purchase(
      self(),
      {
        planCode: "CREATOR",
        interval: "MONTH",
        expectedPlanVersionId: ctx.pro.id,
      },
      "purchase-stale-1",
    ),
    "SUBSCRIPTION_PLAN_CHANGED",
  );
  await rejects(buy(ctx, "CREATOR", "short"), "IDEMPOTENCY_KEY_REQUIRED");
  await rejects(
    ctx.service.purchase(
      { ...self(), permissions: [] },
      {
        planCode: "CREATOR",
        interval: "MONTH",
        expectedPlanVersionId: ctx.creator.id,
      },
      "purchase-key-2",
    ),
    "SUBSCRIPTION_PERMISSION_REQUIRED",
  );
  assert.equal(ctx.wallets()[U], 100_000n);

  const off = setup({ enabled: false });
  await rejects(buy(off), "SUBSCRIPTIONS_DISABLED");
});

test("one current subscription per user; a lapsed term waits for the renewal job", async () => {
  const ctx = setup();
  await buy(ctx);
  await rejects(
    buy(ctx, "PRO", "purchase-key-2"),
    "SUBSCRIPTION_ALREADY_ACTIVE",
  );
  // Another user is independent.
  await buy(ctx, "CREATOR", "purchase-key-3", "MONTH", V);

  // The term lapses and the renewal job has not run yet: nothing is granted, and changes
  // wait, so a row that auto-renews is never closed outside the renewal job.
  ctx.clock.now = new Date(START.getTime() + 31 * DAY);
  const lapsedView = await ctx.service.me(self());
  assert.equal(lapsedView.subscription, null);
  assert.deepEqual(lapsedView.entitlements, DEFAULT_FREE_ENTITLEMENTS);
  await rejects(
    buy(ctx, "PRO", "purchase-key-4"),
    "SUBSCRIPTION_RENEWAL_PENDING",
  );
  await rejects(
    ctx.service.update(self(), { expectedVersion: 1, autoRenew: false }),
    "SUBSCRIPTION_RENEWAL_PENDING",
  );
  // The job expires the row when auto-renew is off; then a new purchase works.
  ctx.db.rows("userSubscription").find((row) => row.userId === U).autoRenew =
    false;
  const mineId = ctx.db
    .rows("userSubscription")
    .find((row) => row.userId === U).id;
  assert.equal(await ctx.renewals.processOne(mineId), "EXPIRED");
  const again = await buy(ctx, "PRO", "purchase-key-5");
  assert.equal(again.subscription.planCode, "PRO");
  const mine = ctx.db
    .rows("userSubscription")
    .filter((row) => row.userId === U);
  assert.deepEqual(mine.map((row) => row.status).sort(), ["ACTIVE", "EXPIRED"]);
});

test("upgrade charges the prorated difference once and switches plan at once", async () => {
  const ctx = setup();
  const bought = await buy(ctx);
  await ctx.service.update(self(), {
    expectedVersion: bought.subscription.version,
    scheduledInterval: "YEAR",
  });
  ctx.clock.now = new Date(START.getTime() + 15 * DAY);
  const quote = await ctx.service.upgradeQuote(self(), "PRO");
  // (299 − 99) × 15/30 = 100.00 Credit.
  assert.equal(quote.amount, "100.00");
  const input = {
    planCode: "PRO",
    expectedPlanVersionId: quote.planVersionId,
    expectedAmount: 10_000n,
    expectedVersion: quote.version,
  };
  await rejects(
    ctx.service.upgrade(
      self(),
      { ...input, expectedAmount: 9_999n },
      "upgrade-key-0",
    ),
    "SUBSCRIPTION_QUOTE_CHANGED",
  );
  await rejects(
    ctx.service.upgrade(
      self(),
      { ...input, expectedVersion: 1 },
      "upgrade-key-9",
    ),
    "SUBSCRIPTION_VERSION_CONFLICT",
  );
  const upgraded = await ctx.service.upgrade(self(), input, "upgrade-key-1");
  assert.equal(upgraded.subscription.planCode, "PRO");
  assert.equal(upgraded.subscription.termEnd, bought.subscription.termEnd);
  // The scheduled interval change survives; an upgrade only clears a scheduled plan.
  assert.equal(upgraded.subscription.scheduledInterval, "YEAR");
  assert.deepEqual(upgraded.entitlements, DEFAULT_PLAN_ENTITLEMENTS.PRO);
  assert.equal(ctx.wallets()[U], 100_000n - 9_900n - 10_000n);
  await ctx.service.upgrade(self(), input, "upgrade-key-1");
  assert.equal(
    ctx.db.rows("subscriptionCharge").filter((row) => row.kind === "UPGRADE")
      .length,
    1,
  );
  await rejects(
    ctx.service.upgradeQuote(self(), "CREATOR"),
    "SUBSCRIPTION_NOT_AN_UPGRADE",
  );
  assert.deepEqual(
    ctx.db.rows("auditLog").map((row) => row.action),
    ["SUBSCRIPTION_PURCHASE", "SUBSCRIPTION_UPDATE", "SUBSCRIPTION_UPGRADE"],
  );
});

test("upgrade needs an ACTIVE subscription", async () => {
  const ctx = setup();
  await rejects(
    ctx.service.upgradeQuote(self(), "PRO"),
    "SUBSCRIPTION_NOT_ACTIVE",
  );
  await buy(ctx);
  const row = ctx.db.rows("userSubscription")[0];
  Object.assign(row, {
    status: "GRACE",
    graceUntil: new Date(START.getTime() + 33 * DAY),
  });
  await rejects(
    ctx.service.upgradeQuote(self(), "PRO"),
    "SUBSCRIPTION_NOT_ACTIVE",
  );
});

test("PATCH keeps omitted fields, clears with null and refuses upgrades", async () => {
  const ctx = setup();
  const { subscription } = await buy(ctx, "PRO");
  const step1 = await ctx.service.update(self(), {
    expectedVersion: subscription.version,
    autoRenew: false,
    scheduledPlanCode: "CREATOR",
  });
  assert.equal(step1.subscription.autoRenew, false);
  assert.equal(step1.subscription.scheduledPlanCode, "CREATOR");
  await rejects(
    ctx.service.update(self(), {
      expectedVersion: subscription.version,
      autoRenew: true,
    }),
    "SUBSCRIPTION_VERSION_CONFLICT",
  );
  // Omitted scheduledPlanCode keeps CREATOR; the same interval as now is no change.
  const step2 = await ctx.service.update(self(), {
    expectedVersion: step1.subscription.version,
    autoRenew: true,
    scheduledInterval: "MONTH",
  });
  assert.equal(step2.subscription.autoRenew, true);
  assert.equal(step2.subscription.scheduledPlanCode, "CREATOR");
  assert.equal(step2.subscription.scheduledInterval, null);
  const step3 = await ctx.service.update(self(), {
    expectedVersion: step2.subscription.version,
    scheduledPlanCode: null,
  });
  assert.equal(step3.subscription.scheduledPlanCode, null);

  const creator = setup();
  const bought = await buy(creator);
  await rejects(
    creator.service.update(self(), {
      expectedVersion: bought.subscription.version,
      scheduledPlanCode: "PRO",
    }),
    "USE_UPGRADE_ENDPOINT",
  );
  // The kill switch never blocks turning renewal off.
  creator.values["subscription.enabled"] = false;
  const off = await creator.service.update(self(), {
    expectedVersion: bought.subscription.version,
    autoRenew: false,
  });
  assert.equal(off.subscription.autoRenew, false);
  await rejects(
    creator.service.update(self(V), { expectedVersion: 1 }),
    "SUBSCRIPTION_NOT_FOUND",
  );
});

test("entitlements reader: FREE defaults, GRACE grants until graceUntil, order kept", async () => {
  const ctx = setup();
  await buy(ctx, "PRO");
  const read = (ids, at) => ctx.reader.forUsers(ctx.db, ids, at);
  const [mine, other, duplicate] = await read([U, V, U]);
  assert.equal(mine.planCode, "PRO");
  assert.equal(mine.subscriptionId, ctx.db.rows("userSubscription")[0].id);
  assert.equal(other.planCode, "FREE");
  assert.deepEqual(other.entitlements, DEFAULT_FREE_ENTITLEMENTS);
  assert.equal(duplicate.planCode, "PRO");
  const row = ctx.db.rows("userSubscription")[0];
  Object.assign(row, {
    status: "GRACE",
    graceUntil: new Date(START.getTime() + 33 * DAY),
  });
  assert.equal(
    (await read([U], new Date(START.getTime() + 32 * DAY)))[0].planCode,
    "PRO",
  );
  assert.equal(
    (await read([U], new Date(START.getTime() + 33 * DAY)))[0].planCode,
    "FREE",
  );
  assert.deepEqual(await read([]), []);
});

test("plan versions: draft, approve, become effective, retire", async () => {
  const ctx = setup();
  const draft = await ctx.plans.create(admin, {
    planCode: "CREATOR",
    monthPrice: 12_900n,
    yearPrice: 120_000n,
    entitlements: DEFAULT_PLAN_ENTITLEMENTS.CREATOR,
    reason: "Raise the Creator price",
  });
  assert.equal(draft.versionNo, 2);
  assert.equal(draft.status, "DRAFT");
  await rejects(
    ctx.plans.create(admin, {
      planCode: "CREATOR",
      monthPrice: 12_900n,
      yearPrice: 120_000n,
      entitlements: DEFAULT_PLAN_ENTITLEMENTS.PRO,
      reason: "Wrong tier",
    }),
    "INVALID_SUBSCRIPTION_ENTITLEMENTS",
  );
  await rejects(
    ctx.plans.create(admin, {
      planCode: "CREATOR",
      monthPrice: 0n,
      yearPrice: 120_000n,
      entitlements: DEFAULT_PLAN_ENTITLEMENTS.CREATOR,
      reason: "Free plan",
    }),
    "INVALID_SUBSCRIPTION_PRICE",
  );
  await rejects(
    ctx.plans.approve(admin, draft.planVersionId, {
      effectiveAt: new Date(START.getTime() - 1),
      reason: "Backdated",
    }),
    "INVALID_EFFECTIVE_AT",
  );
  await rejects(
    ctx.plans.create(self(), {
      planCode: "CREATOR",
      monthPrice: 1n,
      yearPrice: 1n,
      entitlements: DEFAULT_PLAN_ENTITLEMENTS.CREATOR,
      reason: "Not allowed",
    }),
    "SUBSCRIPTION_PERMISSION_REQUIRED",
  );
  const effectiveAt = new Date(START.getTime() + DAY);
  await ctx.plans.approve(admin, draft.planVersionId, {
    effectiveAt,
    reason: "Approved by PO",
  });
  await rejects(
    ctx.plans.approve(admin, draft.planVersionId, {
      effectiveAt,
      reason: "Twice",
    }),
    "SUBSCRIPTION_PLAN_STATE_CONFLICT",
  );
  const before = await ctx.plans.listEffective();
  assert.equal(before.find((plan) => plan.planCode === "CREATOR").versionNo, 1);
  ctx.clock.now = effectiveAt;
  const after = await ctx.plans.listEffective();
  assert.equal(
    after.find((plan) => plan.planCode === "CREATOR").monthPrice,
    "129.00",
  );
  await ctx.plans.retire(admin, draft.planVersionId, { reason: "Rollback" });
  const retired = await ctx.plans.listEffective();
  assert.equal(
    retired.find((plan) => plan.planCode === "CREATOR").versionNo,
    1,
  );
  assert.deepEqual(
    ctx.db.rows("auditLog").map((row) => row.action),
    [
      "SUBSCRIPTION_PLAN_CREATE",
      "SUBSCRIPTION_PLAN_APPROVE",
      "SUBSCRIPTION_PLAN_RETIRE",
    ],
  );
  const listed = await ctx.plans.adminList(admin, {
    planCode: "CREATOR",
    limit: 10,
  });
  assert.deepEqual(listed.data.map((plan) => plan.status).sort(), [
    "APPROVED",
    "RETIRED",
  ]);
});

test("charges and admin reads are scoped to permission and owner", async () => {
  const ctx = setup();
  await buy(ctx);
  const page = await ctx.service.charges(self(), { limit: 10 });
  assert.deepEqual(
    page.data.map(({ kind, planCode, amount }) => ({ kind, planCode, amount })),
    [{ kind: "PURCHASE", planCode: "CREATOR", amount: "99.00" }],
  );
  assert.equal(
    (await ctx.service.charges(self(V), { limit: 10 })).data.length,
    0,
  );
  await rejects(
    ctx.service.adminList(self(), {}),
    "SUBSCRIPTION_PERMISSION_REQUIRED",
  );
  const listed = await ctx.service.adminList(admin, {
    status: "ACTIVE",
    limit: 10,
  });
  assert.equal(listed.data[0].userId, U);
  const detail = await ctx.service.adminUser(admin, U);
  assert.equal(detail.subscriptions.length, 1);
  assert.equal(detail.charges.length, 1);
});
