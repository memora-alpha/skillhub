import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { SessionRecordingService } from "../../dist/modules/learning-sessions/application/services/session-recording.service.js";
import { SessionRecordingEventsService } from "../../dist/modules/learning-sessions/application/services/session-recording-events.service.js";
import { SessionRecordingRetentionService } from "../../dist/modules/learning-sessions/application/services/session-recording-retention.service.js";
import { SubscriptionEntitlementsReader } from "../../dist/modules/subscriptions/application/services/subscription-entitlements.reader.js";
import { B, finalizedOneWay, setup } from "../learning-platform/fixtures.mjs";
import { runner } from "../learning-platform/fake-db.mjs";
import {
  DAY,
  START,
  U,
  V,
  buy,
  rejects,
  seedSubscription,
  self,
  setup as subscriptionSetup,
} from "./support.mjs";

const PERMISSION = "session-recording:manage:participant";
const person = (userId) => ({
  userId,
  roles: ["USER"],
  permissions: [PERMISSION],
});
const TERM_END = new Date("2026-11-14T00:00:00Z");
// Session 2026-11-02 10:00-11:00 UTC.
const END = new Date("2026-11-02T11:00:00Z");

function fakeEgress() {
  let next = 1;
  return {
    available: true,
    async start() {
      return { egressId: `EG_${next++}` };
    },
    async stop() {},
    async list() {
      return [];
    },
    async setIndicator() {},
  };
}

async function ready({ withPlans = true } = {}) {
  const ctx = setup({
    wallets: { [B]: 10000n },
    config: {
      "livekit.joinWindow": { earlyMinutes: 10, lateMinutes: 10 },
      "recording.enabled": true,
      "recording.kind": "ROOM_COMPOSITE_VIDEO",
      "recording.retentionDays": 90,
      "recording.overrunMinutes": 10,
      "recording.monthlyAlertMinutes": 0,
    },
  });
  const ids = await finalizedOneWay(ctx);
  const sessionId = ids.session.id;
  await ctx.db.session.update({
    where: { id: sessionId },
    data: { roomName: `skillhub-session-${sessionId}` },
  });
  ctx.clock.now = new Date("2026-11-02T10:05:00Z");
  // Recording must work without subscription configuration seeded.
  const plans = new SubscriptionEntitlementsReader({
    getSnapshot: async () => {
      throw new Error("subscription configuration must not be read");
    },
  });
  const egress = fakeEgress();
  const storage = { async signGet() {}, async remove() {} };
  const recordings = new SessionRecordingService(
    ctx.db,
    runner(ctx.db),
    ctx.configuration,
    { now: () => ctx.clock.now },
    egress,
    storage,
    undefined,
    withPlans ? plans : undefined,
  );
  const events = new SessionRecordingEventsService(
    ctx.db,
    runner(ctx.db),
    ctx.configuration,
    egress,
    withPlans ? plans : undefined,
  );
  const retention = new SessionRecordingRetentionService(
    ctx.db,
    runner(ctx.db),
    ctx.configuration,
    storage,
  );
  const teacher = person(ids.session.teacherId);
  const learner = person(ids.session.learnerId);
  let egressCount = 0;
  const finish = async (
    durationMs,
    endedAt = new Date("2026-11-02T10:30:00Z"),
  ) =>
    events.applyEgress(ctx.db, {
      egressId: `EG_${egressCount}`,
      status: "COMPLETE",
      startedAt: new Date("2026-11-02T10:05:10Z"),
      endedAt,
      file: { bytes: 4096n, durationMs },
    });
  /** The learner asks, the teacher accepts, Egress finishes with `durationMs`. */
  const record = async (durationMs, endedAt) => {
    const { id } = await recordings.request(learner, sessionId);
    await recordings.accept(teacher, sessionId, id);
    egressCount += 1;
    await finish(durationMs, endedAt);
    return id;
  };
  const row = (id) => ctx.db.rows("sessionRecording").find((r) => r.id === id);
  const usage = () => ctx.db.rows("subscriptionUsage");
  const subscribeLearner = (options = {}) =>
    seedSubscription(
      ctx.db,
      learner.userId,
      options.planCode ?? "CREATOR",
      options.termEnd ?? TERM_END,
      options,
    );
  return {
    ...ctx,
    sessionId,
    recordings,
    events,
    retention,
    teacher,
    learner,
    record,
    finish,
    row,
    usage,
    subscribeLearner,
    egressCount: () => egressCount,
  };
}

const forbidden = (promise, message) =>
  assert.rejects(promise, (error) => {
    assert.ok(error instanceof ForbiddenException);
    assert.equal(error.message, message);
    return true;
  });
const conflict = (promise, message) =>
  assert.rejects(promise, (error) => {
    assert.ok(error instanceof ConflictException);
    assert.equal(error.message, message);
    return true;
  });

test("a Free requester cannot ask for a recording", async () => {
  const ctx = await ready();
  await forbidden(
    ctx.recordings.request(ctx.learner, ctx.sessionId),
    "RECORDING_PLAN_REQUIRED",
  );
  assert.equal(ctx.db.rows("sessionRecording").length, 0);
});

test("a plan without recording minutes or add-ons does not include recording", async () => {
  const ctx = await ready();
  ctx.subscribeLearner({
    entitlements: {
      recordingMinutesPerPeriod: 0,
      recordingAddonAllowed: false,
    },
  });
  await forbidden(
    ctx.recordings.request(ctx.learner, ctx.sessionId),
    "RECORDING_PLAN_REQUIRED",
  );
});

test("the requester's plan pays: start pins it, egress_ended charges rounded-up minutes", async () => {
  const ctx = await ready();
  const subscription = ctx.subscribeLearner();
  const id = await ctx.record(90_000n);
  const recording = ctx.row(id);
  assert.equal(recording.status, "READY");
  assert.equal(recording.subscriptionId, subscription.id);
  assert.equal(recording.retentionDays, 30);
  assert.equal(recording.chargedMinutes, 2);
  const [period] = ctx.usage();
  assert.equal(period.subscriptionId, subscription.id);
  assert.deepEqual(period.periodStart, subscription.termStart);
  assert.equal(period.recordingMinutesAllowed, 120);
  assert.equal(period.recordingMinutesUsed, 2);
});

test("a duplicate egress_ended charges nothing more", async () => {
  const ctx = await ready();
  ctx.subscribeLearner();
  const id = await ctx.record(120_000n);
  await ctx.finish(120_000n);
  assert.equal(ctx.row(id).chargedMinutes, 2);
  assert.equal(ctx.usage()[0].recordingMinutesUsed, 2);
});

test("an overrun finishes, spends add-on minutes, and the rest is absorbed", async () => {
  const ctx = await ready();
  const subscription = ctx.subscribeLearner({
    entitlements: { recordingMinutesPerPeriod: 3 },
  });
  ctx.db.seed("subscriptionUsage", {
    subscriptionId: subscription.id,
    periodStart: subscription.termStart,
    recordingMinutesAllowed: 3,
    recordingMinutesUsed: 0,
    addonMinutesRemaining: 2,
  });
  // 10 minutes: 3 from the period, 2 from add-ons, 5 absorbed by the platform.
  const id = await ctx.record(600_000n);
  assert.equal(ctx.row(id).status, "READY");
  assert.equal(ctx.row(id).chargedMinutes, 5);
  const [period] = ctx.usage();
  assert.equal(period.recordingMinutesUsed, 3);
  assert.equal(period.addonMinutesRemaining, 0);
  await conflict(
    ctx.recordings.request(ctx.learner, ctx.sessionId),
    "RECORDING_MINUTES_EXHAUSTED",
  );
});

test("a plan that ends before egress_ended absorbs the minutes", async () => {
  const ctx = await ready();
  ctx.subscribeLearner({ termEnd: new Date("2026-11-02T10:20:00Z") });
  const id = await ctx.record(600_000n, new Date("2026-11-02T10:30:00Z"));
  const recording = ctx.row(id);
  assert.equal(recording.status, "READY");
  assert.equal(recording.chargedMinutes, 0);
  // Retention was pinned at start and survives the plan ending.
  assert.equal(recording.retentionDays, 30);
  assert.equal(ctx.usage().length, 0);
});

test("a plan that lapses between request and accept stops the start", async () => {
  const ctx = await ready();
  ctx.subscribeLearner({ termEnd: new Date("2026-11-02T10:05:30Z") });
  const { id } = await ctx.recordings.request(ctx.learner, ctx.sessionId);
  ctx.clock.now = new Date("2026-11-02T10:06:00Z");
  await forbidden(
    ctx.recordings.accept(ctx.teacher, ctx.sessionId, id),
    "RECORDING_PLAN_REQUIRED",
  );
  assert.equal(ctx.row(id).status, "REQUESTED");
});

test("retention follows the snapshot, which may be shorter than the config value", async () => {
  const ctx = await ready();
  ctx.subscribeLearner();
  const pinned = await ctx.record(60_000n);
  // A legacy row from before plans: no snapshot, so recording.retentionDays (90) applies.
  const legacy = ctx.db.seed("sessionRecording", {
    ...ctx.row(pinned),
    id: "0f0f0f0f-0000-4000-8000-0000000000aa",
    egressId: "EG_legacy",
    retentionDays: null,
    subscriptionId: null,
    chargedMinutes: null,
  });
  const listed = await ctx.recordings.list(ctx.learner, ctx.sessionId);
  const byId = new Map(listed.items.map((item) => [item.id, item]));
  assert.equal(byId.get(pinned).retentionDays, 30);
  assert.deepEqual(byId.get(pinned).expiresAt, new Date(+END + 30 * DAY));
  assert.equal(byId.get(legacy.id).retentionDays, 90);

  ctx.clock.now = new Date(+END + 30 * DAY - 1);
  assert.equal((await ctx.retention.expirePage(100)).expired, 0);
  ctx.clock.now = new Date(+END + 30 * DAY);
  assert.deepEqual(await ctx.retention.expirePage(100), {
    expired: 1,
    next: null,
  });
  assert.equal(ctx.row(pinned).status, "EXPIRED");
  assert.equal(ctx.row(legacy.id).status, "READY");
  ctx.clock.now = new Date(+END + 90 * DAY);
  assert.equal((await ctx.retention.expirePage(100)).expired, 1);
  assert.equal(ctx.row(legacy.id).status, "EXPIRED");
});

test("without the plan reader recording keeps the spec 020 behaviour", async () => {
  const ctx = await ready({ withPlans: false });
  const id = await ctx.record(60_000n);
  assert.equal(ctx.row(id).status, "READY");
  assert.equal(ctx.row(id).retentionDays, null);
  assert.equal(ctx.row(id).chargedMinutes, null);
});

test("GRACE charges the term's last period instead of opening a new one", async () => {
  const ctx = await ready();
  const termStart = new Date("2026-10-03T00:00:00Z");
  const subscription = ctx.subscribeLearner({
    status: "GRACE",
    termStart,
    termEnd: new Date("2026-11-02T00:00:00Z"),
    graceUntil: new Date("2026-11-05T00:00:00Z"),
  });
  await ctx.record(60_000n);
  const [period] = ctx.usage();
  assert.deepEqual(period.periodStart, termStart);
  assert.equal(period.recordingMinutesUsed, 1);
  assert.equal(period.subscriptionId, subscription.id);
});

// --- Add-on purchase (spec 021 D14) ---

function addonSetup(options) {
  const ctx = subscriptionSetup(options);
  ctx.values["subscription.recordingAddon"] = { minutes: 60, priceCredit: 30 };
  return ctx;
}
const addon = (ctx, packs, key = "addon-key-1", price = 30, user = U) =>
  ctx.service.buyRecordingMinutes(
    self(user),
    { packs, expectedPriceCredit: price },
    key,
  );

test("add-on packs charge Credit and add minutes for the term", async () => {
  const ctx = addonSetup();
  await buy(ctx, "CREATOR");
  const before = ctx.wallets()[U];
  const usage = await addon(ctx, 2);
  assert.equal(usage.addonMinutesRemaining, 120);
  assert.equal(usage.recordingMinutesAllowed, 120);
  assert.equal(ctx.wallets()[U], before - 6_000n);
  const charge = ctx.db
    .rows("subscriptionCharge")
    .find((row) => row.kind === "RECORDING_ADDON");
  assert.equal(charge.quantity, 2);
  assert.equal(charge.amount, 6_000n);
  const audit = ctx.db
    .rows("auditLog")
    .find((row) => row.action === "SUBSCRIPTION_RECORDING_ADDON");
  assert.ok(audit);
  // A replay of the same key charges once.
  await addon(ctx, 2);
  assert.equal(ctx.wallets()[U], before - 6_000n);
});

test("add-on minutes carry to the next period of the term, not past a renewal", async () => {
  const ctx = addonSetup();
  await buy(ctx, "CREATOR");
  await addon(ctx, 1);
  const subscription = ctx.db.rows("userSubscription")[0];
  ctx.clock.now = new Date(START.getTime() + 29 * DAY);
  const usage = await ctx.service.me(self(U));
  assert.equal(usage.usage.addonMinutesRemaining, 60);
  // After a renewal the term starts again: earlier add-on rows are outside it.
  subscription.termStart = new Date(START.getTime() + 30 * DAY);
  subscription.termEnd = new Date(START.getTime() + 60 * DAY);
  const allowance = await ctx.reader.recordingAllowance(
    ctx.db,
    U,
    new Date(START.getTime() + 31 * DAY),
  );
  assert.equal(allowance.remainingMinutes, 120);
});

test("add-on sales are refused for Free users, a changed price or a disabled flag", async () => {
  const ctx = addonSetup();
  await rejects(addon(ctx, 1), "RECORDING_ADDON_NOT_ALLOWED");
  await buy(ctx, "CREATOR", "purchase-key-1", "MONTH", U);
  await rejects(
    addon(ctx, 1, "addon-key-2", 25),
    "RECORDING_ADDON_PRICE_CHANGED",
  );
  await rejects(addon(ctx, 11, "addon-key-3"), "RECORDING_ADDON_PACKS_INVALID");
  ctx.values["subscription.enabled"] = false;
  await rejects(addon(ctx, 1, "addon-key-4"), "SUBSCRIPTIONS_DISABLED");
  assert.equal(
    ctx.db
      .rows("subscriptionCharge")
      .filter((row) => row.kind === "RECORDING_ADDON").length,
    0,
  );
});

test("a plan without add-ons refuses the sale", async () => {
  const ctx = addonSetup();
  const creator = ctx.db.rows("subscriptionPlanVersion")[0];
  creator.entitlements = {
    ...creator.entitlements,
    recordingAddonAllowed: false,
  };
  await buy(ctx, "CREATOR", "purchase-key-1", "MONTH", V);
  await rejects(
    addon(ctx, 1, "addon-key-1", 30, V),
    "RECORDING_ADDON_NOT_ALLOWED",
  );
});

// --- Upgrade mid-period ---

async function upgradeToPro(ctx) {
  ctx.clock.now = new Date(START.getTime() + 15 * DAY);
  const quote = await ctx.service.upgradeQuote(self(U), "PRO");
  return ctx.service.upgrade(
    self(U),
    {
      planCode: "PRO",
      expectedPlanVersionId: quote.planVersionId,
      expectedAmount: 10_000n,
      expectedVersion: quote.version,
    },
    "upgrade-key-1",
  );
}

test("an upgrade raises the current period's allowance and keeps minutes used", async () => {
  const ctx = addonSetup();
  await buy(ctx, "CREATOR");
  const subscription = ctx.db.rows("userSubscription")[0];
  ctx.db.seed("subscriptionUsage", {
    subscriptionId: subscription.id,
    periodStart: subscription.termStart,
    recordingMinutesAllowed: 120,
    recordingMinutesUsed: 100,
    addonMinutesRemaining: 60,
  });
  const upgraded = await upgradeToPro(ctx);
  assert.equal(upgraded.usage.recordingMinutesAllowed, 400);
  assert.equal(upgraded.usage.recordingMinutesUsed, 100);
  assert.equal(upgraded.usage.addonMinutesRemaining, 60);
  const allowance = await ctx.reader.recordingAllowance(
    ctx.db,
    U,
    ctx.clock.now,
  );
  assert.equal(allowance.remainingMinutes, 300 + 60);
});

test("an upgrade before any usage row starts the period at the new allowance", async () => {
  const ctx = addonSetup();
  await buy(ctx, "CREATOR");
  const upgraded = await upgradeToPro(ctx);
  assert.equal(upgraded.usage.recordingMinutesAllowed, 400);
  assert.equal(ctx.db.rows("subscriptionUsage").length, 0);
});
