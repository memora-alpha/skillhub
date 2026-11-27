import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException } from "@nestjs/common";
import { MaterialsService } from "../../dist/modules/materials/application/services/materials.service.js";
import { DEFAULT_FREE_ENTITLEMENTS } from "../../dist/modules/subscriptions/domain/plan-entitlements.js";
import { SubscriptionEntitlementsReader } from "../../dist/modules/subscriptions/application/services/subscription-entitlements.reader.js";
import { createFakeDb, runner } from "../learning-platform/fake-db.mjs";
import {
  U,
  seedSubscription,
  self,
  setup as subscriptionSetup,
} from "./support.mjs";

const SKILL = "0c0c0c0c-0000-4000-8000-00000000000c";
const owner = {
  userId: U,
  roles: ["USER"],
  permissions: ["material:create:self"],
};
const FAR = new Date("2099-01-01T00:00:00Z");

/** Materials wired with a fake upload binder: `fileId` is `file-<bytes>`. */
function ready({ enabled = true, freeBytes = "1000", withPlans = true } = {}) {
  const db = createFakeDb({ now: () => new Date() });
  db.seed("skill", { id: SKILL, status: "ACTIVE" });
  const values = {
    "subscription.enabled": enabled,
    "subscription.freeEntitlements": {
      ...DEFAULT_FREE_ENTITLEMENTS,
      materialStorageBytes: freeBytes,
    },
  };
  const configuration = {
    values,
    getSnapshot: async (keys) => ({
      values: Object.fromEntries(keys.map((key) => [key, values[key]])),
    }),
  };
  const attachments = {
    async attachReady(_tx, _principal, fileId) {
      return {
        id: fileId,
        key: `materials/${fileId}`,
        originalName: `${fileId}.pdf`,
        mime: "application/pdf",
        size: Number(fileId.split("-")[1]),
        checksum: "0".repeat(64),
        uploadedAt: new Date(),
      };
    },
  };
  const thumbnails = {
    publicProjection: async () => ({ kind: "PLACEHOLDER" }),
  };
  const service = new MaterialsService(
    runner(db),
    {},
    attachments,
    thumbnails,
    undefined,
    undefined,
    withPlans ? new SubscriptionEntitlementsReader(configuration) : undefined,
  );
  // The owner projection joins thumbnails, which the fake database cannot shape; the quota
  // only needs the stored row.
  const rowOf = (id) => db.rows("material").find((item) => item.id === id);
  service.ownerProjection = async (id) => rowOf(id);
  service.ownerProjectionFromRow = async (row) => rowOf(row.id);
  const findUniqueOrThrow = db.material.findUniqueOrThrow;
  db.material.findUniqueOrThrow = ({ where }) => findUniqueOrThrow({ where });
  const create = (bytes, title = `Material ${bytes}`) =>
    service.create(owner, {
      skillId: SKILL,
      title,
      description: "A study guide for the course.",
      accessType: "FREE",
      priceCredit: "0",
      distributionRightsConfirmed: true,
      fileId: `file-${bytes}`,
    });
  return { db, values, service, create };
}

const quotaExceeded = (promise, usedBytes) =>
  assert.rejects(promise, (error) => {
    assert.ok(error instanceof ConflictException);
    const body = error.getResponse();
    assert.equal(body.message, "MATERIAL_STORAGE_QUOTA_EXCEEDED");
    assert.equal(body.usedBytes, usedBytes);
    return true;
  });

test("an attach past the Free allowance is refused and rolls back", async () => {
  const ctx = ready();
  await ctx.create(600);
  await quotaExceeded(ctx.create(500), "600");
  assert.equal(ctx.db.rows("material").length, 1);
  // Exactly at the allowance is allowed.
  await ctx.create(400);
  assert.equal(ctx.db.rows("material").length, 2);
});

test("replacing a material's file does not count its old file", async () => {
  const ctx = ready();
  const first = await ctx.create(600);
  const updated = await ctx.service.update(owner, first.id, {
    expectedListingVersion: first.listingVersion,
    fileId: "file-900",
    distributionRightsConfirmed: true,
  });
  assert.equal(updated.sizeBytes, 900n);
  await quotaExceeded(
    ctx.service.update(owner, first.id, {
      expectedListingVersion: updated.listingVersion,
      fileId: "file-1001",
      distributionRightsConfirmed: true,
    }),
    "0",
  );
});

test("a removed material stops counting at once; an archived one still counts", async () => {
  const ctx = ready();
  const first = await ctx.create(600);
  const row = ctx.db.rows("material").find((item) => item.id === first.id);
  row.status = "ARCHIVED";
  await quotaExceeded(ctx.create(500), "600");
  await ctx.service.remove(owner, first.id, row.listingVersion);
  await ctx.create(500);
});

test("with subscriptions off, or without the reader, no quota applies", async () => {
  const off = ready({ enabled: false });
  await off.create(600);
  await off.create(900);
  const unwired = ready({ withPlans: false });
  await unwired.create(5000);
  assert.equal(unwired.db.rows("material").length, 1);
});

test("a plan raises the allowance; after it ends materials stay and new attaches stop", async () => {
  const ctx = ready();
  const subscription = seedSubscription(ctx.db, U, "CREATOR", FAR, {
    entitlements: { materialStorageBytes: "2000" },
  });
  await ctx.create(1500);
  subscription.status = "EXPIRED";
  // Over the Free allowance now: existing materials are untouched, a new attach is refused.
  await quotaExceeded(ctx.create(10), "1500");
  assert.equal(ctx.db.rows("material").length, 1);
  assert.equal(ctx.db.rows("material")[0].deletedAt, null);
});

test("GET /me/subscription reports storage for Free users too", async () => {
  const ctx = subscriptionSetup();
  for (const [sizeBytes, deletedAt] of [
    [700n, null],
    [300n, null],
    [5_000n, new Date()],
  ])
    ctx.db.seed("material", { ownerId: U, sizeBytes, deletedAt });
  const me = await ctx.service.me(self(U));
  assert.equal(me.usage, null);
  assert.deepEqual(me.materialStorage, {
    usedBytes: "1000",
    allowedBytes: DEFAULT_FREE_ENTITLEMENTS.materialStorageBytes,
    enforced: true,
  });
  ctx.values["subscription.enabled"] = false;
  assert.equal((await ctx.service.me(self(U))).materialStorage.enforced, false);
});

test("the admin user view includes usage, entitlements and storage", async () => {
  const ctx = subscriptionSetup();
  const admin = {
    userId: "0d0d0d0d-0000-4000-8000-00000000000d",
    roles: ["ADMIN"],
    permissions: ["subscription:read"],
  };
  const view = await ctx.service.adminUser(admin, U);
  assert.equal(view.usage, null);
  assert.equal(view.materialStorage.usedBytes, "0");
  assert.deepEqual(view.entitlements, DEFAULT_FREE_ENTITLEMENTS);
});
