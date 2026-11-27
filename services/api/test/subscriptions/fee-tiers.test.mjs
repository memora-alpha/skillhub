import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { FeePolicyAdminService } from "../../dist/modules/credit/application/services/fee-policy-admin.service.js";
import { effectiveFeePolicy } from "../../dist/modules/credit/application/services/fee-policy.reader.js";
import {
  A,
  B,
  completedOneWay,
  finalizeAs,
  scheduledTwoWay,
  setup as platformSetup,
  wallet,
} from "../learning-platform/fixtures.mjs";
import { createFakeDb } from "../learning-platform/fake-db.mjs";
import { DAY, START, U, buy, setup } from "./support.mjs";

const NOW = new Date("2026-10-20T00:00:00.000Z");

function seedPolicy(db, policyCode, calculationRule, extra = {}) {
  return db.seed("feePolicyVersion", {
    policyCode,
    versionNo: 1,
    calculationRule,
    roundingRule: { mode: "DOWN", precision: 2 },
    status: "APPROVED",
    approvedAt: NOW,
    effectiveAt: NOW,
    ...extra,
  });
}

/** Path fixtures with a plan-tier reader injected the way Nest injects it. */
function withTiers(tiers, options = {}) {
  const ctx = platformSetup({ wallets: { [A]: 0n, [B]: 10_000n }, ...options });
  const calls = [];
  ctx.paths.feeTiers = {
    feeTier: async (_tx, userId) => {
      calls.push(userId);
      return tiers[userId] ?? null;
    },
  };
  return { ...ctx, calls };
}

const agreementOf = (ctx, pathId) =>
  ctx.db.rows("learningPathVersion").find((row) => row.pathId === pathId);

test("ONE_WAY pins the teacher's tier policy and settles with it", async () => {
  const ctx = withTiers({ [A]: "PRO" });
  const tier = seedPolicy(ctx.db, "ONE_WAY_PRO", {
    returnedBps: 9800,
    feeBps: 200,
  });
  const { pathId } = await completedOneWay(ctx);
  const agreement = agreementOf(ctx, pathId);
  assert.equal(agreement.feePolicyId, tier.id);
  assert.equal(agreement.feeRateSnapshot, "0.02");
  assert.equal(agreement.feeAmountSnapshot, 200n);
  // Only the teacher's plan is read, once, when the fee is pinned.
  assert.deepEqual(ctx.calls, [A]);

  ctx.clock.now = new Date("2026-11-05T00:00:00Z");
  // The plan ending before settlement does not change the pinned rate.
  ctx.paths.feeTiers = { feeTier: async () => null };
  const settled = await ctx.sessions.settlePath(
    { userId: B, roles: ["USER"], permissions: [] },
    pathId,
  );
  assert.deepEqual([settled.gross, settled.fee], ["100.00", "2.00"]);
  assert.equal(wallet(ctx.db, A).availableCredit, 9800n);
  assert.deepEqual(
    ctx.db
      .rows("creditTransaction")
      .filter((row) => row.type === "PLATFORM_FEE")
      .map((row) => row.amount),
    [200n],
  );
});

test("a teacher on a tier without an approved tier policy pays the base fee", async () => {
  const ctx = withTiers({ [A]: "CREATOR" });
  // A PRO policy exists but does not apply to a CREATOR teacher; a future one is not effective.
  seedPolicy(ctx.db, "ONE_WAY_PRO", { returnedBps: 9800, feeBps: 200 });
  seedPolicy(
    ctx.db,
    "ONE_WAY_CREATOR",
    { returnedBps: 9700, feeBps: 300 },
    { effectiveAt: new Date("2027-01-01T00:00:00Z") },
  );
  const { pathId } = await completedOneWay(ctx);
  const agreement = agreementOf(ctx, pathId);
  const base = ctx.db
    .rows("feePolicyVersion")
    .find((row) => row.policyCode === "ONE_WAY");
  assert.equal(agreement.feePolicyId, base.id);
  assert.equal(agreement.feeRateSnapshot, "0.04");
});

test("TWO_WAY never reads a plan tier", async () => {
  const ctx = withTiers(
    { [A]: "PRO", [B]: "PRO" },
    { wallets: { [A]: 10_000n, [B]: 10_000n } },
  );
  seedPolicy(ctx.db, "ONE_WAY_PRO", { returnedBps: 9800, feeBps: 200 });
  const { pathId } = await scheduledTwoWay(ctx, "20.00");
  await finalizeAs(ctx, A, pathId);
  const agreement = agreementOf(ctx, pathId);
  assert.equal(agreement.feeRateSnapshot, "0.04");
  assert.deepEqual(ctx.calls, []);
});

test("effectiveFeePolicy prefers an effective tier version and falls back to the base", async () => {
  const db = createFakeDb({ now: () => NOW });
  const base = seedPolicy(db, "MATERIAL_PAID", { feeBps: 500 });
  const pro = seedPolicy(db, "MATERIAL_PAID_PRO", { feeBps: 300 });
  const proV2 = seedPolicy(
    db,
    "MATERIAL_PAID_PRO",
    { feeBps: 250 },
    {
      versionNo: 2,
      effectiveAt: new Date(NOW.getTime() + DAY),
    },
  );
  seedPolicy(db, "MATERIAL_PAID_CREATOR", { feeBps: 400 }, { status: "DRAFT" });
  assert.equal(
    (await effectiveFeePolicy(db, "MATERIAL_PAID", "PRO", NOW)).id,
    pro.id,
  );
  assert.equal(
    (
      await effectiveFeePolicy(
        db,
        "MATERIAL_PAID",
        "PRO",
        new Date(NOW.getTime() + DAY),
      )
    ).id,
    proV2.id,
  );
  // A DRAFT tier policy never applies.
  assert.equal(
    (await effectiveFeePolicy(db, "MATERIAL_PAID", "CREATOR", NOW)).id,
    base.id,
  );
  assert.equal(
    (await effectiveFeePolicy(db, "MATERIAL_PAID", null, NOW)).id,
    base.id,
  );
  assert.equal(await effectiveFeePolicy(db, "ONE_WAY", "PRO", NOW), null);
});

test("feeTier reads the current plan without reading configuration", async () => {
  const ctx = setup();
  const configuration = ctx.reader.configuration;
  // A configuration read throws inside feeTier; fee pinning must not depend on it.
  const feeTier = async (at) => {
    ctx.reader.configuration = {
      getSnapshot: async () => {
        throw new Error("configuration must not be read");
      },
    };
    try {
      return await ctx.reader.feeTier(ctx.db, U, at);
    } finally {
      ctx.reader.configuration = configuration;
    }
  };
  assert.equal(await feeTier(START), null);
  await buy(ctx, "PRO");
  assert.equal(await feeTier(START), "PRO");
  assert.equal(await feeTier(new Date(START.getTime() + 30 * DAY)), null);
});

test("fee policy admin drafts tier series with the rule shape of their base", async () => {
  const db = createFakeDb({ now: () => NOW });
  const admin = {
    userId: A,
    roles: ["ADMIN"],
    permissions: ["fee-policy:manage"],
  };
  const audits = [];
  const service = new FeePolicyAdminService(
    { run: (work) => work(db) },
    { assertLive: async () => admin },
    { consumeReauth: async () => {} },
    { append: async (_tx, entry) => audits.push(entry) },
    undefined,
  );
  const draft = (policyCode, feeBps) =>
    service.create(admin, {
      policyCode,
      versionNo: 1,
      feeBps,
      reason: "Plan tier fee",
      reauthToken: "token",
    });
  const learning = await draft("ONE_WAY_PRO", 200);
  assert.deepEqual(learning.calculationRule, {
    returnedBps: 9800,
    feeBps: 200,
  });
  const material = await draft("MATERIAL_PAID_CREATOR", 400);
  assert.deepEqual(material.calculationRule, { feeBps: 400 });
  assert.deepEqual(
    audits.map((entry) => entry.action),
    ["LEARNING_FEE_POLICY_CREATE", "MATERIAL_FEE_POLICY_CREATE"],
  );
  // TWO_WAY has no tier series; create validates synchronously.
  assert.throws(() => draft("TWO_WAY_PRO", 200), /INVALID_FEE_POLICY/);
});
