import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { MaterialsService } from "../../dist/modules/materials/application/services/materials.service.js";
import { MaterialModerationService } from "../../dist/modules/materials/application/services/material-moderation.service.js";
import { ownerMaterialView } from "../../dist/modules/materials/application/contracts/material-view.js";

const owner = { userId: "owner", permissions: ["material:create:self"] };
const staff = {
  userId: "staff",
  permissions: ["material:moderate"],
  roles: ["STAFF"],
};
function fixture(patch = {}) {
  let row = {
    id: "material",
    ownerId: "owner",
    status: "DRAFT",
    listingVersion: 4,
    hasBeenPublished: false,
    deletedAt: null,
    legacyArchiveUnclassified: false,
    title: "Original title",
    description: "Original description",
    accessType: "FREE",
    priceCredit: 0n,
    coverGeneration: 0,
    coverFileId: null,
    coverFileRecord: null,
    materialThumbnailMaterialIdRecords: [],
    storageKey: "private/file",
    scanStatus: "CLEAN",
    distributionRightsConfirmedAt: new Date(),
    ...patch,
  };
  const tx = {
    $queryRaw: async () => [],
    material: {
      findUnique: async () => row,
      findUniqueOrThrow: async () => row,
      update: async ({ data }) => {
        row = {
          ...row,
          ...data,
          listingVersion:
            row.listingVersion + (data.listingVersion?.increment ?? 0),
          updatedAt: new Date(),
        };
        return row;
      },
    },
    storedFile: { findUnique: async () => ({ id: "file" }) },
    outboxEvent: { create: async () => ({}) },
  };
  const transactions = { run: (work) => work(tx) };
  return {
    service: new MaterialsService(transactions, undefined, undefined, {
      publicProjection: async () => ({ kind: "PLACEHOLDER" }),
    }),
    moderation: new MaterialModerationService(transactions, {
      append: async () => {},
    }),
  };
}

test("PATCH blocks every content change after publication even in draft/rejected state", async () => {
  for (const status of [
    "PUBLISHED",
    "ARCHIVED",
    "PENDING_REVIEW",
    "DRAFT",
    "REJECTED",
    "HIDDEN",
  ]) {
    const { service } = fixture({ status, hasBeenPublished: true });
    for (const change of [
      { title: "New title" },
      { description: "New description" },
      { skillId: "skill" },
      { accessType: "PAID", priceCredit: "10" },
      { coverFileId: "cover" },
      { fileId: "file", distributionRightsConfirmed: true },
    ]) {
      await assert.rejects(
        service.update(owner, "material", {
          expectedListingVersion: 4,
          ...change,
        }),
        /MATERIAL_CONTENT_LOCKED/,
      );
    }
  }
});

test("owner projection explains permanent and temporary edit locks", () => {
  for (const [status, published, editable, reason] of [
    ["DRAFT", false, true, null],
    ["REJECTED", false, true, null],
    ["PENDING_REVIEW", false, false, "MATERIAL_NOT_EDITABLE"],
    ["DRAFT", true, false, "MATERIAL_CONTENT_LOCKED"],
  ]) {
    const view = ownerMaterialView({
      status,
      hasBeenPublished: published,
      priceCredit: 0n,
    });
    assert.equal(view.canEdit, editable);
    assert.equal(view.editBlockedReason, reason);
  }
});

test("submit and archive reject a version the owner did not confirm", async () => {
  for (const [action, status] of [
    ["submit", "DRAFT"],
    ["archive", "PUBLISHED"],
  ]) {
    const { service } = fixture({ status });
    await assert.rejects(
      service[action](owner, "material", 3),
      /MATERIAL_VERSION_CONFLICT/,
    );
    await assert.rejects(
      service[action](owner, "material"),
      /MATERIAL_VERSION_INVALID/,
    );
    const result = await service[action](owner, "material", 4);
    assert.equal(result.listingVersion, 5);
  }
});

test("moderation increments versions and an old hide fails after hide/unhide", async () => {
  const { moderation } = fixture({ status: "PENDING_REVIEW" });
  const approved = await moderation.moderate(staff, "material", "approve", {
    expectedListingVersion: 4,
  });
  assert.equal(approved.listingVersion, 5);
  assert.equal(approved.hasBeenPublished, true);
  const hidden = await moderation.moderate(staff, "material", "hide", {
    expectedListingVersion: 5,
    reason: "Review claim",
  });
  assert.equal(hidden.listingVersion, 6);
  const restored = await moderation.moderate(staff, "material", "unhide", {
    expectedListingVersion: 6,
    reason: "Claim dismissed",
  });
  assert.equal(restored.listingVersion, 7);
  await assert.rejects(
    moderation.moderate(staff, "material", "hide", {
      expectedListingVersion: 5,
      reason: "Old request",
    }),
    /MATERIAL_VERSION_CONFLICT/,
  );
});
