import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { AuditWriter } from "../../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../../dist/modules/audit/infrastructure/persistence/audit.repository.js";
import {
  raisedRetentionDays,
  whiteboardRetentionDays,
} from "../../dist/modules/learning-sessions/domain/whiteboard.policy.js";
import { SessionWhiteboardService } from "../../dist/modules/learning-sessions/application/services/session-whiteboard.service.js";
import { DEFAULT_PLAN_ENTITLEMENTS } from "../../dist/modules/subscriptions/domain/plan-entitlements.js";
import { SubscriptionEntitlementsReader } from "../../dist/modules/subscriptions/application/services/subscription-entitlements.reader.js";
import {
  A,
  B,
  finalizedOneWay,
  setup,
} from "../learning-platform/fixtures.mjs";
import { runner } from "../learning-platform/fake-db.mjs";

const DAY = 86_400_000;
const participant = (userId) => ({
  userId,
  roles: ["USER"],
  permissions: [
    "session:read:participant",
    "session-whiteboard:update:participant",
  ],
});
const scene = (id) => ({
  elements: [{ id, type: "rectangle", version: 1, versionNonce: 7 }],
});

// Session 2026-11-02 10:00-11:00 UTC; edits close 24 hours after it ends.
const END = new Date("2026-11-02T11:00:00Z");

/** Seeds a current plan for `userId` ending at `termEnd`. */
function subscribe(db, userId, planCode, termEnd) {
  const version = db.seed("subscriptionPlanVersion", {
    planCode,
    versionNo: 1,
    monthPrice: 9_900n,
    yearPrice: 95_000n,
    entitlements: DEFAULT_PLAN_ENTITLEMENTS[planCode],
    status: "APPROVED",
    effectiveAt: new Date("2026-10-01T00:00:00Z"),
    approvedAt: new Date("2026-10-01T00:00:00Z"),
    createdByUserId: userId,
  });
  return db.seed("userSubscription", {
    userId,
    planCode,
    planVersionId: version.id,
    interval: "MONTH",
    status: "ACTIVE",
    termStart: new Date("2026-10-15T00:00:00Z"),
    termEnd,
  });
}

async function ready({ withPlans = true } = {}) {
  const ctx = setup({
    wallets: { [B]: 10000n },
    config: {
      "livekit.joinWindow": { earlyMinutes: 10, lateMinutes: 10 },
      "whiteboard.editWindow": { teacherPrepare: true, afterEndMinutes: 1440 },
      "whiteboard.retentionDays": 30,
    },
  });
  const ids = await finalizedOneWay(ctx);
  ctx.clock.now = new Date("2026-11-02T10:05:00Z");
  // The reader must not need subscription configuration: Free adds nothing here.
  const plans = new SubscriptionEntitlementsReader({
    getSnapshot: async () => {
      throw new Error("subscription configuration must not be read");
    },
  });
  const whiteboards = new SessionWhiteboardService(
    ctx.db,
    runner(ctx.db),
    ctx.configuration,
    { now: () => ctx.clock.now },
    new AuditWriter(new AuditRepository()),
    withPlans ? plans : undefined,
  );
  const board = () => ctx.db.rows("sessionWhiteboard")[0];
  let revision = 0;
  const save = async (userId) => {
    const saved = await whiteboards.save(
      participant(userId),
      ids.session.id,
      revision,
      scene(`e${revision}`),
    );
    revision = saved.revision;
    return saved;
  };
  return { ...ctx, ...ids, whiteboards, board, save };
}

const purgeAt = async (ctx, at) => {
  ctx.clock.now = at;
  return ctx.whiteboards.purgeExpired(100);
};

test("retention helpers only raise the snapshot and never go below config", () => {
  assert.equal(raisedRetentionDays(null, []), null);
  assert.equal(raisedRetentionDays(null, [180, 365]), 365);
  assert.equal(raisedRetentionDays(365, [180]), 365);
  assert.equal(raisedRetentionDays(180, []), 180);
  assert.equal(whiteboardRetentionDays(null, 30), 30);
  assert.equal(whiteboardRetentionDays(180, 30), 180);
  assert.equal(whiteboardRetentionDays(20, 30), 30);
});

test("Free participants leave no snapshot and keep the config retention", async () => {
  const ctx = await ready();
  await ctx.save(A);
  assert.equal(ctx.board().retentionDays, null);
  assert.equal((await purgeAt(ctx, new Date(+END + 30 * DAY - 1))).deleted, 0);
  assert.equal((await purgeAt(ctx, new Date(+END + 30 * DAY))).deleted, 1);
});

test("a save takes the longest plan of either participant", async () => {
  const ctx = await ready();
  subscribe(ctx.db, A, "CREATOR", new Date("2026-12-15T00:00:00Z"));
  subscribe(ctx.db, B, "PRO", new Date("2026-12-15T00:00:00Z"));
  // The learner's PRO plan applies even when the teacher saves.
  await ctx.save(A);
  assert.equal(ctx.board().retentionDays, 365);
});

test("the snapshot never decreases after a plan ends", async () => {
  const ctx = await ready();
  // A's plan ends 10 minutes into the Session.
  subscribe(ctx.db, A, "PRO", new Date("2026-11-02T10:15:00Z"));
  await ctx.save(A);
  assert.equal(ctx.board().retentionDays, 365);
  ctx.clock.now = new Date("2026-11-02T10:30:00Z");
  await ctx.save(B);
  assert.equal(ctx.board().retentionDays, 365);
});

test("a plan bought before the edit window closes raises the snapshot", async () => {
  const ctx = await ready();
  await ctx.save(A);
  assert.equal(ctx.board().retentionDays, null);
  subscribe(ctx.db, B, "CREATOR", new Date("2026-12-15T00:00:00Z"));
  ctx.clock.now = new Date("2026-11-03T09:00:00Z");
  await ctx.save(B);
  assert.equal(ctx.board().retentionDays, 180);
});

test("the worker keeps a board for its snapshot, not the config value", async () => {
  const ctx = await ready();
  subscribe(ctx.db, A, "CREATOR", new Date("2026-12-15T00:00:00Z"));
  await ctx.save(A);
  // Past the 30-day config value the row is examined but kept.
  assert.deepEqual(await purgeAt(ctx, new Date(+END + 31 * DAY)), {
    deleted: 0,
    next: null,
  });
  assert.equal((await purgeAt(ctx, new Date(+END + 180 * DAY - 1))).deleted, 0);
  assert.equal((await purgeAt(ctx, new Date(+END + 180 * DAY))).deleted, 1);
});

test("a longer config value wins over a shorter snapshot", async () => {
  const ctx = await ready();
  subscribe(ctx.db, A, "CREATOR", new Date("2026-12-15T00:00:00Z"));
  await ctx.save(A);
  ctx.configuration.values["whiteboard.retentionDays"] = 200;
  assert.equal((await purgeAt(ctx, new Date(+END + 180 * DAY))).deleted, 0);
  assert.equal((await purgeAt(ctx, new Date(+END + 200 * DAY))).deleted, 1);
});

test("read shows the effective retention once the Session has ended", async () => {
  const ctx = await ready();
  subscribe(ctx.db, A, "PRO", new Date("2026-12-15T00:00:00Z"));
  await ctx.save(A);
  const during = await ctx.whiteboards.read(participant(B), ctx.session.id);
  assert.equal(during.retentionDays, null);
  ctx.clock.now = new Date("2026-11-02T11:00:00Z");
  const after = await ctx.whiteboards.read(participant(B), ctx.session.id);
  assert.equal(after.retentionDays, 365);
});

test("without the plan reader saves keep the legacy null snapshot", async () => {
  const ctx = await ready({ withPlans: false });
  subscribe(ctx.db, A, "PRO", new Date("2026-12-15T00:00:00Z"));
  await ctx.save(A);
  assert.equal(ctx.board().retentionDays, null);
});
