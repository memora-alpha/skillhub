import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { SubscriptionNotificationHandler } from "../../dist/modules/notifications/infrastructure/events/subscription-notification.handler.js";
import { DAY, START, U, buy, self, setup } from "./support.mjs";

const at = (days) => new Date(START.getTime() + days * DAY);
const row = (ctx) =>
  ctx.db.rows("userSubscription").find((r) => r.userId === U);
const charges = (ctx, kind) =>
  ctx.db.rows("subscriptionCharge").filter((c) => c.kind === kind);
const events = (ctx) => ctx.db.rows("outboxEvent").map((e) => e.type);
const setWallet = (ctx, amount) => {
  ctx.db.rows("creditWallet").find((w) => w.userId === U).availableCredit =
    amount;
};

async function subscribed(options = {}, planCode = "CREATOR") {
  const ctx = setup(options);
  await buy(ctx, planCode);
  return ctx;
}

test("renews at term end once, continuing from the old term end", async () => {
  const ctx = await subscribed();
  const id = row(ctx).id;
  ctx.clock.now = at(29);
  assert.equal(await ctx.renewals.processOne(id), "NOT_DUE");
  assert.equal(charges(ctx, "RENEWAL").length, 0);

  ctx.clock.now = new Date(at(30).getTime() + 90_000);
  assert.equal(await ctx.renewals.processOne(id), "RENEWED");
  const renewed = row(ctx);
  assert.equal(renewed.status, "ACTIVE");
  assert.deepEqual(renewed.termStart, at(30));
  assert.deepEqual(renewed.termEnd, at(60));
  assert.deepEqual(renewed.nextRenewalAttemptAt, at(60));
  assert.equal(ctx.wallets()[U], 100_000n - 2n * 9_900n);
  const [charge] = charges(ctx, "RENEWAL");
  assert.equal(charge.amount, 9_900n);
  assert.match(charge.idempotencyKey, /^[0-9a-f]{64}$/);

  // A repeated run for the same term end changes nothing.
  assert.equal(await ctx.renewals.processOne(id), "NOT_DUE");
  assert.equal(charges(ctx, "RENEWAL").length, 1);
  assert.deepEqual(events(ctx), ["subscription.renewed"]);
  const audit = ctx.db.rows("auditLog").at(-1);
  assert.equal(audit.action, "SUBSCRIPTION_RENEW");
  assert.equal(audit.actorKind, "SYSTEM");
  assert.equal(audit.systemActor, "subscription-renewal");
});

test("auto-renew off expires at term end without a charge", async () => {
  const ctx = await subscribed();
  const { subscription } = await ctx.service.update(self(), {
    expectedVersion: 1,
    autoRenew: false,
  });
  assert.equal(subscription.autoRenew, false);
  ctx.clock.now = at(30);
  assert.equal(await ctx.renewals.processOne(row(ctx).id), "EXPIRED");
  assert.equal(row(ctx).status, "EXPIRED");
  assert.deepEqual(row(ctx).endedAt, at(30));
  assert.equal(row(ctx).nextRenewalAttemptAt, null);
  assert.equal(charges(ctx, "RENEWAL").length, 0);
  const [event] = ctx.db.rows("outboxEvent");
  assert.equal(event.type, "subscription.expired");
  assert.equal(event.payload.reason, "AUTO_RENEW_OFF");
  // An expired row is never processed again.
  assert.equal(await ctx.renewals.processOne(row(ctx).id), "SKIPPED");
});

test("short Credit enters grace, keeps entitlements, then renews after a top-up", async () => {
  const ctx = await subscribed();
  const id = row(ctx).id;
  setWallet(ctx, 100n);
  ctx.clock.now = at(30);
  assert.equal(await ctx.renewals.processOne(id), "GRACE");
  assert.equal(row(ctx).status, "GRACE");
  assert.deepEqual(row(ctx).graceUntil, at(33));
  assert.deepEqual(row(ctx).nextRenewalAttemptAt, at(31));
  const grace = ctx.db.rows("outboxEvent")[0];
  assert.equal(grace.type, "subscription.grace-started");
  assert.equal(grace.payload.amountDue, "9900");
  // Entitlements stay during grace.
  const [during] = await ctx.reader.forUsers(ctx.db, [U], at(32));
  assert.equal(during.planCode, "CREATOR");

  ctx.clock.now = at(31);
  assert.equal(await ctx.renewals.processOne(id), "RETRY_LATER");
  assert.deepEqual(row(ctx).nextRenewalAttemptAt, at(32));
  ctx.clock.now = at(32.5);
  assert.equal(await ctx.renewals.processOne(id), "RETRY_LATER");
  // The next retry never lands after the grace end.
  assert.deepEqual(row(ctx).nextRenewalAttemptAt, at(33));

  setWallet(ctx, 50_000n);
  assert.equal(await ctx.renewals.processOne(id), "RENEWED");
  assert.equal(row(ctx).status, "ACTIVE");
  assert.equal(row(ctx).graceUntil, null);
  // The renewed term starts at the original term end, not at the top-up.
  assert.deepEqual(row(ctx).termStart, at(30));
  assert.deepEqual(row(ctx).termEnd, at(60));
  assert.deepEqual(events(ctx), [
    "subscription.grace-started",
    "subscription.renewed",
  ]);
});

test("grace that elapses unpaid expires at graceUntil", async () => {
  const ctx = await subscribed();
  const id = row(ctx).id;
  setWallet(ctx, 0n);
  ctx.clock.now = at(30);
  await ctx.renewals.processOne(id);
  ctx.clock.now = at(33);
  assert.equal(await ctx.renewals.processOne(id), "EXPIRED");
  assert.deepEqual(row(ctx).endedAt, at(33));
  const [after] = await ctx.reader.forUsers(ctx.db, [U], at(33));
  assert.equal(after.planCode, "FREE");
  assert.equal(
    ctx.db.rows("outboxEvent").at(-1).payload.reason,
    "GRACE_ELAPSED",
  );
});

test("zero grace days expire at the term end", async () => {
  const ctx = await subscribed();
  ctx.values["subscription.graceDays"] = 0;
  setWallet(ctx, 0n);
  ctx.clock.now = at(30);
  assert.equal(await ctx.renewals.processOne(row(ctx).id), "EXPIRED");
  assert.deepEqual(row(ctx).endedAt, at(30));
});

test("scheduled downgrade and interval apply at renewal with the new price", async () => {
  const ctx = await subscribed({ wallet: 500_000n }, "PRO");
  await ctx.service.update(self(), {
    expectedVersion: 1,
    scheduledPlanCode: "CREATOR",
    scheduledInterval: "YEAR",
  });
  ctx.clock.now = at(30);
  assert.equal(await ctx.renewals.processOne(row(ctx).id), "RENEWED");
  const renewed = row(ctx);
  assert.equal(renewed.planCode, "CREATOR");
  assert.equal(renewed.planVersionId, ctx.creator.id);
  assert.equal(renewed.interval, "YEAR");
  assert.deepEqual(renewed.termEnd, at(30 + 365));
  assert.equal(renewed.scheduledPlanCode, null);
  assert.equal(renewed.scheduledInterval, null);
  assert.equal(ctx.wallets()[U], 500_000n - 29_900n - 95_000n);
});

test("a very late run never buys a term that has already passed", async () => {
  const ctx = await subscribed();
  ctx.clock.now = at(75);
  assert.equal(await ctx.renewals.processOne(row(ctx).id), "RENEWED");
  assert.deepEqual(row(ctx).termStart, at(75));
  assert.deepEqual(row(ctx).termEnd, at(105));
  assert.equal(charges(ctx, "RENEWAL").length, 1);
});

test("a plan with no effective version expires instead of renewing", async () => {
  const ctx = await subscribed();
  ctx.creator.status = "RETIRED";
  ctx.clock.now = at(30);
  assert.equal(await ctx.renewals.processOne(row(ctx).id), "EXPIRED");
  assert.equal(
    ctx.db.rows("outboxEvent")[0].payload.reason,
    "PLAN_UNAVAILABLE",
  );
  assert.equal(charges(ctx, "RENEWAL").length, 0);
});

test("notification handler renders each renewal event for the owner only", async () => {
  const types = [];
  const sent = [];
  const handler = new SubscriptionNotificationHandler(
    { register: (type) => types.push(type) },
    { dispatch: async (message) => sent.push(message) },
  );
  handler.onModuleInit();
  assert.deepEqual(types, [
    "subscription.renewed",
    "subscription.grace-started",
    "subscription.expired",
  ]);
  const base = { subscriptionId: randomUUID(), userId: U, planCode: "PRO" };
  const event = (type, payload) => ({
    eventId: randomUUID(),
    type,
    version: 2,
    correlationId: randomUUID(),
    payload: { ...base, ...payload },
  });
  await handler.publish(
    event("subscription.grace-started", {
      amountDue: "29900",
      graceUntil: "2027-01-03T00:00:00.000Z",
    }),
  );
  assert.deepEqual(sent[0].userIds, [U]);
  assert.match(sent[0].title, /Creator Pro/);
  assert.match(sent[0].body, /299\.00 Credit/);
  assert.deepEqual(sent[0].payload, {
    subscriptionId: base.subscriptionId,
    planCode: "PRO",
  });
  await handler.publish(
    event("subscription.expired", {
      reason: "AUTO_RENEW_OFF",
      endedAt: "2027-01-01T00:00:00.000Z",
    }),
  );
  assert.match(sent[1].body, /Tự động gia hạn đã tắt/);
  for (const bad of [
    event("subscription.expired", {
      reason: "OTHER",
      endedAt: "2027-01-01T00:00:00.000Z",
    }),
    event("subscription.renewed", {
      amount: "0",
      interval: "MONTH",
      termEnd: "2027-01-01T00:00:00.000Z",
    }),
    event("subscription.unknown", {}),
    {
      ...event("subscription.grace-started", {
        amountDue: "1",
        graceUntil: "2027-01-01T00:00:00.000Z",
      }),
      version: 0,
    },
  ])
    await assert.rejects(handler.publish(bad), /INVALID_SUBSCRIPTION_EVENT/);
  assert.equal(sent.length, 2);
});

test("a top-up after graceUntil does not renew: the plan expires without a charge", async () => {
  const ctx = await subscribed();
  const id = row(ctx).id;
  setWallet(ctx, 0n);
  ctx.clock.now = at(30);
  assert.equal(await ctx.renewals.processOne(id), "GRACE");
  // The job is late: the deadline passed, and the user topped up in between.
  setWallet(ctx, 50_000n);
  ctx.clock.now = at(34);
  assert.equal(await ctx.renewals.processOne(id), "EXPIRED");
  assert.equal(row(ctx).status, "EXPIRED");
  assert.deepEqual(row(ctx).endedAt, at(33));
  assert.equal(charges(ctx, "RENEWAL").length, 0);
  assert.equal(
    ctx.db.rows("outboxEvent").at(-1).payload.reason,
    "GRACE_ELAPSED",
  );
});
