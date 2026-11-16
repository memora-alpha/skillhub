import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateMaterialDto } from "../../dist/modules/materials/presentation/http/materials.dto.js";
import { MaterialModerationService } from "../../dist/modules/materials/application/services/material-moderation.service.js";
import { MaterialsService } from "../../dist/modules/materials/application/services/materials.service.js";
import { MaterialThumbnailsService } from "../../dist/modules/materials/application/services/material-thumbnails.service.js";
import { createMaterialFixture } from "./fixture.mjs";

test("create DTO leaves the rights confirmation to the service", async () => {
  const dto = (distributionRightsConfirmed) =>
    plainToInstance(CreateMaterialDto, {
      skillId: randomUUID(),
      title: "Docker basics",
      description: "Hands-on Docker notes for beginners",
      accessType: "FREE",
      priceCredit: "0",
      distributionRightsConfirmed,
    });
  // false passes validation so the service can answer MATERIAL_RIGHTS_CONFIRMATION_REQUIRED.
  assert.deepEqual(await validate(dto(false)), []);
  // A non-boolean is still a plain validation error.
  assert.equal((await validate(dto("yes"))).length, 1);
});

test("owner material lifecycle on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const owner = await f.account();
    const other = await f.account();
    let material;
    await t.test("creates a DRAFT without a file", async () => {
      material = await f.materials.create(owner.principal, f.draftInput());
      assert.equal(material.status, "DRAFT");
      assert.equal(material.priceCredit, "0.00");
      assert.equal(material.file, null);
      assert.equal("storageKey" in material, false);
    });
    await t.test("rejects unconfirmed rights", async () => {
      await assert.rejects(
        f.materials.create(
          owner.principal,
          f.draftInput({ distributionRightsConfirmed: false }),
        ),
        /MATERIAL_RIGHTS_CONFIRMATION_REQUIRED/,
      );
    });
    await t.test("rejects invalid price and inactive skill", async () => {
      await assert.rejects(
        f.materials.create(owner.principal, f.draftInput({ priceCredit: "5" })),
        /MATERIAL_PRICE_INVALID/,
      );
      await assert.rejects(
        f.materials.create(
          owner.principal,
          f.draftInput({ skillId: randomUUID() }),
        ),
        /MATERIAL_SKILL_INVALID/,
      );
    });
    await t.test("submit needs a file", async () => {
      await assert.rejects(
        f.materials.submit(owner.principal, material.id),
        /MATERIAL_FILE_REQUIRED/,
      );
    });
    await t.test(
      "null file removal is rejected instead of silently ignored",
      async () => {
        await assert.rejects(
          f.materials.update(owner.principal, material.id, {
            expectedListingVersion: material.listingVersion,
            fileId: null,
          }),
          /MATERIAL_FILE_REMOVAL_UNSUPPORTED/,
        );
      },
    );
    await t.test(
      "attaching a file needs rights confirmation and the current version",
      async () => {
        const file = await f.materialFile(owner);
        await assert.rejects(
          f.materials.update(owner.principal, material.id, {
            expectedListingVersion: 1,
            fileId: file.id,
          }),
          /MATERIAL_RIGHTS_CONFIRMATION_REQUIRED/,
        );
        await assert.rejects(
          f.materials.update(owner.principal, material.id, {
            expectedListingVersion: 9,
            fileId: file.id,
            distributionRightsConfirmed: true,
          }),
          /MATERIAL_VERSION_CONFLICT/,
        );
        material = await f.materials.update(owner.principal, material.id, {
          expectedListingVersion: 1,
          fileId: file.id,
          distributionRightsConfirmed: true,
        });
        assert.equal(material.listingVersion, 2);
        assert.equal(material.scanStatus, "CLEAN");
        assert.equal(material.file.mimeType, "application/pdf");
      },
    );
    await t.test("other users cannot see or edit the draft", async () => {
      await assert.rejects(
        f.materials.update(other.principal, material.id, {
          expectedListingVersion: 2,
          title: "Hacked title",
        }),
        /MATERIAL_NOT_FOUND/,
      );
    });
    await t.test("submit moves DRAFT to PENDING_REVIEW", async () => {
      const draftVersion = material.listingVersion;
      material = await f.materials.submit(owner.principal, material.id);
      assert.equal(material.status, "PENDING_REVIEW");
      assert.equal(material.moderationStatus, "PENDING");
      assert.equal(material.listingVersion, draftVersion + 1);
      const mine = await f.materials.listMine(owner.principal);
      assert.deepEqual(
        mine.data.map((m) => m.id),
        [material.id],
      );
    });
    await t.test(
      "only published materials can be archived and the owner can still find them",
      async () => {
        await assert.rejects(
          f.materials.archive(owner.principal, material.id),
          /MATERIAL_TRANSITION_INVALID/,
        );
        const published = await f.publishedMaterial(owner);
        await assert.rejects(
          f.materials.archive(other.principal, published.id),
          /MATERIAL_NOT_FOUND/,
        );
        const archived = await f.materials.archive(
          owner.principal,
          published.id,
        );
        assert.equal(archived.status, "ARCHIVED");
        assert.equal(archived.listingVersion, published.listingVersion + 1);
        assert.equal(
          (
            await f.db.material.findUniqueOrThrow({
              where: { id: archived.id },
            })
          ).deletedAt,
          null,
        );
        assert.deepEqual(
          await f.materials.getMine(owner.principal, archived.id),
          archived,
        );
        await assert.rejects(
          f.materials.getMine(other.principal, archived.id),
          /MATERIAL_NOT_FOUND/,
        );
        assert.equal(
          (await f.materials.listMine(owner.principal)).data.some(
            ({ id }) => id === archived.id,
          ),
          false,
        );
        assert.deepEqual(
          (
            await f.materials.listMine(owner.principal, { status: "ARCHIVED" })
          ).data.map(({ id }) => id),
          [archived.id],
        );
        await assert.rejects(
          f.catalog.detail(archived.id),
          /MATERIAL_NOT_FOUND/,
        );
      },
    );
    await t.test(
      "draft deletion is owner-only, versioned, hidden from mine, and replay-safe",
      async () => {
        const draft = await f.materials.create(
          owner.principal,
          f.draftInput({ title: "Disposable material draft" }),
        );
        await assert.rejects(
          f.materials.remove(other.principal, draft.id, draft.listingVersion),
          /MATERIAL_NOT_FOUND/,
        );
        await assert.rejects(
          f.materials.remove(owner.principal, draft.id, 99),
          /MATERIAL_VERSION_CONFLICT/,
        );
        const removed = await f.materials.remove(
          owner.principal,
          draft.id,
          draft.listingVersion,
        );
        assert.deepEqual(removed, {
          id: draft.id,
          deleted: true,
          replayed: false,
        });
        const tombstone = await f.db.material.findUniqueOrThrow({
          where: { id: draft.id },
        });
        assert.equal(tombstone.status, "ARCHIVED");
        assert.ok(tombstone.deletedAt instanceof Date);
        assert.equal(tombstone.listingVersion, draft.listingVersion + 1);
        assert.equal(
          (await f.materials.listMine(owner.principal)).data.some(
            (entry) => entry.id === draft.id,
          ),
          false,
        );
        assert.equal(
          (
            await f.materials.remove(
              owner.principal,
              draft.id,
              draft.listingVersion,
            )
          ).replayed,
          true,
        );
        await assert.rejects(
          f.materials.getMine(owner.principal, draft.id),
          /MATERIAL_NOT_FOUND/,
        );
        await assert.rejects(
          f.materials.remove(other.principal, draft.id, draft.listingVersion),
          /MATERIAL_NOT_FOUND/,
        );
        await assert.rejects(
          f.materials.remove(owner.principal, randomUUID(), 1),
          /MATERIAL_NOT_FOUND/,
        );
        await assert.rejects(
          f.materials.remove(
            owner.principal,
            material.id,
            material.listingVersion,
          ),
          /MATERIAL_DELETE_NOT_ALLOWED/,
        );
      },
    );
    await t.test(
      "archived pagination is scoped and excludes deleted and unknown legacy rows",
      async () => {
        const existing = await f.db.material.findFirstOrThrow({
          where: {
            ownerId: owner.user.id,
            status: "ARCHIVED",
            deletedAt: null,
          },
        });
        const second = await f.publishedMaterial(owner);
        await f.materials.archive(owner.principal, second.id);
        const third = await f.publishedMaterial(owner);
        await f.materials.archive(owner.principal, third.id);
        const ids = [existing.id, second.id, third.id].sort((left, right) =>
          right.localeCompare(left),
        );
        await f.db.material.updateMany({
          where: { id: { in: ids } },
          data: { updatedAt: new Date("2026-11-17T00:00:00Z") },
        });
        const legacy = await f.materials.create(
          owner.principal,
          f.draftInput(),
        );
        await f.db.material.update({
          where: { id: legacy.id },
          data: { status: "ARCHIVED", legacyArchiveUnclassified: true },
        });
        const query = { status: "ARCHIVED", limit: 1 };
        const first = await f.materials.listMine(owner.principal, query);
        assert.deepEqual(
          first.data.map(({ id }) => id),
          [ids[0]],
        );
        assert.ok(first.pagination.nextCursor);
        const next = { ...query, cursor: first.pagination.nextCursor };
        await assert.rejects(
          f.materials.listMine(owner.principal, { ...next, status: "DRAFT" }),
          /INVALID_CURSOR/,
        );
        await assert.rejects(
          f.materials.listMine(other.principal, next),
          /INVALID_CURSOR/,
        );
        const tiedPage = await f.materials.listMine(owner.principal, next);
        assert.deepEqual(
          tiedPage.data.map(({ id }) => id),
          [ids[1]],
        );

        const current = tiedPage.data[0];
        await assert.rejects(
          f.materials.remove(
            owner.principal,
            current.id,
            current.listingVersion - 1,
          ),
          /MATERIAL_VERSION_CONFLICT/,
        );
        const results = await Promise.all([
          f.materials.remove(
            owner.principal,
            current.id,
            current.listingVersion,
          ),
          f.materials.remove(
            owner.principal,
            current.id,
            current.listingVersion,
          ),
        ]);
        assert.equal(results.filter(({ replayed }) => replayed).length, 1);
        assert.ok(results.every(({ deleted }) => deleted));
        const afterDelete = await f.materials.listMine(owner.principal, next);
        assert.deepEqual(
          afterDelete.data.map(({ id }) => id),
          [ids[2]],
        );
        assert.equal(afterDelete.pagination.nextCursor, null);
        for (const id of [current.id, legacy.id]) {
          await assert.rejects(
            f.materials.getMine(owner.principal, id),
            /MATERIAL_NOT_FOUND/,
          );
          await assert.rejects(
            f.materials.archive(owner.principal, id),
            /MATERIAL_NOT_FOUND/,
          );
          await assert.rejects(
            f.materials.submit(owner.principal, id),
            /MATERIAL_NOT_FOUND/,
          );
          await assert.rejects(
            f.materials.withdraw(owner.principal, id, 1),
            /MATERIAL_NOT_FOUND/,
          );
          await assert.rejects(
            f.materials.update(owner.principal, id, {
              expectedListingVersion: 1,
              title: "Another title",
            }),
            /MATERIAL_NOT_FOUND/,
          );
        }
        await assert.rejects(
          f.materials.remove(owner.principal, legacy.id, legacy.listingVersion),
          /MATERIAL_NOT_FOUND/,
        );
      },
    );
    await t.test(
      "staff approve, reject with reason, hide and unhide with audit",
      async () => {
        const published = await f.publishedMaterial(owner);
        assert.equal(published.status, "PUBLISHED");
        assert.equal(published.moderationStatus, "APPROVED");
        await assert.rejects(
          f.moderation.moderate(owner.principal, published.id, "hide", {
            expectedListingVersion: published.listingVersion,
            reason: "spam",
          }),
          /STAFF_ACCESS_REQUIRED/,
        );
        await assert.rejects(
          f.moderation.moderate(f.moderator.principal, published.id, "hide", {
            expectedListingVersion: published.listingVersion,
          }),
          /MATERIAL_REASON_REQUIRED/,
        );
        const hidden = await f.moderation.moderate(
          f.moderator.principal,
          published.id,
          "hide",
          {
            expectedListingVersion: published.listingVersion,
            reason: "Copyright claim",
          },
        );
        assert.equal(hidden.status, "HIDDEN");
        await assert.rejects(
          f.materials.update(owner.principal, published.id, {
            expectedListingVersion: hidden.listingVersion,
            title: "Escaping review",
          }),
          /MATERIAL_NOT_EDITABLE/,
        );
        const restored = await f.moderation.moderate(
          f.moderator.principal,
          published.id,
          "unhide",
          {
            expectedListingVersion: hidden.listingVersion,
            reason: "Claim withdrawn",
          },
        );
        assert.equal(restored.status, "PUBLISHED");
        const audits = await f.db.auditLog.count({
          where: { action: "MATERIAL_MODERATE", targetId: published.id },
        });
        assert.equal(audits, 3);
        const events = await f.db.outboxEvent.count({
          where: { type: "material.moderated", aggregateId: published.id },
        });
        assert.equal(events, 3);
      },
    );
    await t.test(
      "editing a PUBLISHED material returns it to review",
      async () => {
        const live = await f.publishedMaterial(owner);
        const edited = await f.materials.update(owner.principal, live.id, {
          expectedListingVersion: live.listingVersion,
          description: "Updated description text",
        });
        assert.equal(edited.status, "PENDING_REVIEW");
        const rejected = await f.moderation.moderate(
          f.moderator.principal,
          live.id,
          "reject",
          {
            expectedListingVersion: edited.listingVersion,
            reason: "Needs clearer scope",
          },
        );
        assert.equal(rejected.status, "REJECTED");
        assert.equal(rejected.rejectReason, "Needs clearer scope");
        const queue = await f.moderation.queue(
          f.moderator.principal,
          "REJECTED",
        );
        assert.ok(queue.data.some((m) => m.id === live.id));
        // Editing a rejected listing makes a clean DRAFT again (D3).
        const redrafted = await f.materials.update(owner.principal, live.id, {
          expectedListingVersion: rejected.listingVersion,
          title: "Docker basics, clearer scope",
        });
        assert.equal(redrafted.status, "DRAFT");
        assert.equal(redrafted.moderationStatus, "NONE");
        assert.equal(redrafted.rejectReason, null);
      },
    );
    await t.test(
      "a stale approve cannot publish an edit Staff never reviewed",
      async () => {
        const file = await f.materialFile(owner);
        const draft = await f.materials.create(
          owner.principal,
          f.draftInput({ fileId: file.id }),
        );
        const pending = await f.materials.submit(owner.principal, draft.id);
        const edited = await f.materials.update(owner.principal, draft.id, {
          expectedListingVersion: pending.listingVersion,
          description: "Swapped content after submission",
        });
        assert.equal(edited.status, "PENDING_REVIEW");
        await assert.rejects(
          f.moderation.moderate(f.moderator.principal, draft.id, "approve", {
            expectedListingVersion: pending.listingVersion,
          }),
          /MATERIAL_VERSION_CONFLICT/,
        );
        const approved = await f.moderation.moderate(
          f.moderator.principal,
          draft.id,
          "approve",
          { expectedListingVersion: edited.listingVersion },
        );
        assert.equal(approved.status, "PUBLISHED");
        assert.equal(approved.description, "Swapped content after submission");
      },
    );
    await t.test(
      "staff cannot approve or unhide their own material",
      async () => {
        const own = f.moderator;
        const file = await f.materialFile(own);
        const draft = await f.materials.create(
          own.principal,
          f.draftInput({ fileId: file.id }),
        );
        const pending = await f.materials.submit(own.principal, draft.id);
        const version = { expectedListingVersion: pending.listingVersion };
        await assert.rejects(
          f.moderation.moderate(own.principal, draft.id, "approve", version),
          /MATERIAL_SELF_REVIEW_FORBIDDEN/,
        );
        const peer = await f.account("STAFF");
        await f.moderation.moderate(
          peer.principal,
          draft.id,
          "approve",
          version,
        );
        await f.moderation.moderate(own.principal, draft.id, "hide", {
          ...version,
          reason: "Pulling my own listing",
        });
        await assert.rejects(
          f.moderation.moderate(own.principal, draft.id, "unhide", {
            ...version,
            reason: "Restoring my own listing",
          }),
          /MATERIAL_SELF_REVIEW_FORBIDDEN/,
        );
      },
    );
    await t.test(
      "deleting a redrafted listing preserves its purchase history",
      async () => {
        const buyer = await f.account();
        await f.fund(buyer, 5000n);
        const published = await f.publishedMaterial(owner, {
          title: "Purchased then redrafted material",
          accessType: "PAID",
          priceCredit: "10",
        });
        const purchase = await f.purchases.purchase(
          buyer.principal,
          published.id,
          published.listingVersion,
          "delete-history-purchase",
        );
        const pending = await f.materials.update(
          owner.principal,
          published.id,
          {
            expectedListingVersion: published.listingVersion,
            description: "A changed version awaiting a new moderation decision",
          },
        );
        const rejected = await f.moderation.moderate(
          f.moderator.principal,
          published.id,
          "reject",
          {
            expectedListingVersion: pending.listingVersion,
            reason: "Needs revision before it can be published again",
          },
        );
        const redrafted = await f.materials.update(
          owner.principal,
          published.id,
          {
            expectedListingVersion: rejected.listingVersion,
            title: "Purchased material under revision",
          },
        );
        await f.materials.remove(
          owner.principal,
          published.id,
          redrafted.listingVersion,
        );
        assert.ok(
          await f.db.materialOrder.findUnique({
            where: { id: purchase.order.id },
          }),
        );
      },
    );
  } finally {
    await f.dispose();
  }
});

test("a stopped material can be edited and republished only after fresh Staff review", async () => {
  const f = await createMaterialFixture();
  try {
    const owner = await f.account();
    const other = await f.account();
    const published = await f.publishedMaterial(owner, {
      accessType: "PAID",
      priceCredit: "10",
    });
    const archived = await f.materials.archive(owner.principal, published.id);
    await assert.rejects(
      f.materials.submit(other.principal, archived.id),
      /MATERIAL_NOT_FOUND/,
    );
    const edited = await f.materials.update(owner.principal, archived.id, {
      expectedListingVersion: archived.listingVersion,
      title: "Updated archived material",
    });
    assert.equal(edited.status, "ARCHIVED");
    const oldApproval = { expectedListingVersion: edited.listingVersion };
    await assert.rejects(
      f.moderation.moderate(
        f.moderator.principal,
        edited.id,
        "approve",
        oldApproval,
      ),
      /MATERIAL_TRANSITION_INVALID/,
    );
    await assert.rejects(f.catalog.detail(edited.id), /MATERIAL_NOT_FOUND/);
    await assert.rejects(
      f.purchases.purchase(
        other.principal,
        edited.id,
        edited.listingVersion,
        "buy-archived",
      ),
      /MATERIAL_NOT_PUBLISHED/,
    );

    const pending = await f.materials.submit(owner.principal, edited.id);
    assert.equal(pending.id, published.id);
    assert.equal(pending.listingVersion, edited.listingVersion + 1);
    assert.equal(pending.status, "PENDING_REVIEW");
    assert.equal(pending.moderationStatus, "PENDING");
    assert.equal(pending.reviewedAt, null);
    await assert.rejects(f.catalog.detail(edited.id), /MATERIAL_NOT_FOUND/);
    await assert.rejects(
      f.purchases.purchase(
        other.principal,
        edited.id,
        pending.listingVersion,
        "buy-pending",
      ),
      /MATERIAL_NOT_PUBLISHED/,
    );
    await assert.rejects(
      f.moderation.moderate(
        f.moderator.principal,
        pending.id,
        "approve",
        oldApproval,
      ),
      /MATERIAL_VERSION_CONFLICT/,
    );
    const republished = await f.moderation.moderate(
      f.moderator.principal,
      pending.id,
      "approve",
      { expectedListingVersion: pending.listingVersion },
    );
    assert.equal(republished.id, published.id);
    assert.equal((await f.catalog.detail(republished.id)).title, edited.title);

    const archivedAgain = await f.materials.archive(
      owner.principal,
      republished.id,
    );
    await f.db.material.update({
      where: { id: republished.id },
      data: { distributionRightsConfirmedAt: null },
    });
    await assert.rejects(
      f.materials.submit(owner.principal, archivedAgain.id),
      /MATERIAL_FILE_REQUIRED/,
    );
    await f.db.material.update({
      where: { id: republished.id },
      data: {
        distributionRightsConfirmedAt: new Date(),
        scanStatus: "INFECTED",
      },
    });
    await assert.rejects(
      f.materials.submit(owner.principal, archivedAgain.id),
      /MATERIAL_FILE_REQUIRED/,
    );
    const { storageKey } = await f.db.material.update({
      where: { id: republished.id },
      data: { scanStatus: "CLEAN" },
    });
    // A legacy listing can point to a row whose scan disagrees with its snapshot.
    const rejectedFile = await f.readyFile(owner, {
      purpose: "MATERIAL",
      resourceType: "MATERIAL",
      resourceId: republished.id,
      attachedAt: new Date(),
      state: "REJECTED",
      scanVerdict: "INFECTED",
    });
    await f.db.material.update({
      where: { id: republished.id },
      data: { storageKey: rejectedFile.objectKey },
    });
    await assert.rejects(
      f.materials.submit(owner.principal, archivedAgain.id),
      /MATERIAL_FILE_REQUIRED/,
    );
    await f.db.material.update({
      where: { id: republished.id },
      data: { storageKey },
    });
    const direct = await f.materials.submit(owner.principal, archivedAgain.id);
    assert.equal(direct.status, "PENDING_REVIEW");
    await f.db.material.update({
      where: { id: republished.id },
      data: { storageKey: rejectedFile.objectKey },
    });
    await assert.rejects(
      f.moderation.moderate(f.moderator.principal, direct.id, "approve", {
        expectedListingVersion: direct.listingVersion,
      }),
      /MATERIAL_FILE_REQUIRED/,
    );

    const hidden = await f.moderation.moderate(
      f.moderator.principal,
      direct.id,
      "hide",
      { expectedListingVersion: direct.listingVersion, reason: "Unsafe file" },
    );
    await assert.rejects(
      f.materials.update(owner.principal, hidden.id, {
        expectedListingVersion: hidden.listingVersion,
        title: "No longer editable",
      }),
      /MATERIAL_NOT_EDITABLE/,
    );
    await assert.rejects(
      f.materials.submit(owner.principal, hidden.id),
      /MATERIAL_TRANSITION_INVALID/,
    );
  } finally {
    await f.dispose();
  }
});

test("withdrawal and Staff decisions serialize in both orders on PostgreSQL", async () => {
  const f = await createMaterialFixture();
  try {
    const owner = await f.account();
    const newPending = async () => {
      const file = await f.materialFile(owner);
      const draft = await f.materials.create(
        owner.principal,
        f.draftInput({ fileId: file.id }),
      );
      return f.materials.submit(owner.principal, draft.id);
    };
    for (const winner of ["approve", "reject", "withdraw"]) {
      const pending = await newPending();
      const { id, listingVersion } = pending;
      const moderation = (runner, action) =>
        new MaterialModerationService(runner, f.audit).moderate(
          f.moderator.principal,
          id,
          action,
          { expectedListingVersion: listingVersion, reason: "Staff decision" },
        );
      const withdraw = (runner) =>
        new MaterialsService(
          runner,
          f.storage,
          f.attachments,
          new MaterialThumbnailsService(f.objectStorage),
        ).withdraw(owner.principal, id, listingVersion);
      const staffWins = winner !== "withdraw";
      const [first, second] = await runReviewRace(
        f,
        id,
        staffWins ? (runner) => moderation(runner, winner) : withdraw,
        staffWins ? withdraw : (runner) => moderation(runner, "approve"),
      );
      assert.equal(first.status, "fulfilled");
      assert.equal(second.status, "rejected");
      assert.equal(second.reason.getStatus(), 409);
      if (staffWins) {
        const currentStatus = winner === "approve" ? "PUBLISHED" : "REJECTED";
        assert.equal(first.value.status, currentStatus);
        assert.deepEqual(second.reason.getResponse(), {
          message: "MATERIAL_TRANSITION_INVALID",
          details: { currentStatus, currentListingVersion: listingVersion },
        });
        assert.equal(
          (await f.materials.getMine(owner.principal, id)).status,
          currentStatus,
        );
      } else {
        assert.equal(first.value.status, "DRAFT");
        assert.equal(first.value.listingVersion, listingVersion + 1);
        assert.equal(first.value.moderationStatus, "NONE");
        assert.equal(first.value.reviewedAt, null);
        assert.equal(second.reason.message, "MATERIAL_VERSION_CONFLICT");
        assert.ok(
          !(await f.moderation.queue(f.moderator.principal)).data.some(
            (row) => row.id === id,
          ),
        );
        const resubmitted = await f.materials.submit(owner.principal, id);
        assert.equal(resubmitted.listingVersion, listingVersion + 2);
        await assert.rejects(
          moderation(f.transactions, "approve"),
          /MATERIAL_VERSION_CONFLICT/,
        );
        await assert.rejects(
          f.materials.withdraw(owner.principal, id, listingVersion),
          (error) => {
            assert.deepEqual(error.getResponse(), {
              message: "MATERIAL_VERSION_CONFLICT",
              details: {
                currentStatus: "PENDING_REVIEW",
                currentListingVersion: resubmitted.listingVersion,
              },
            });
            return true;
          },
        );
      }
      assert.equal(
        await f.db.auditLog.count({
          where: { action: "MATERIAL_MODERATE", targetId: id },
        }),
        staffWins ? 1 : 0,
      );
      assert.equal(
        await f.db.outboxEvent.count({
          where: { type: "material.moderated", aggregateId: id },
        }),
        staffWins ? 1 : 0,
      );
    }
  } finally {
    await f.dispose();
  }
});

async function runReviewRace(f, id, first, second) {
  const acquired = Promise.withResolvers();
  const release = Promise.withResolvers();
  const contender = Promise.withResolvers();
  const winner = f.transactions.run(async (tx) => {
    await tx.$queryRaw`SELECT material_id FROM materials WHERE material_id = ${id}::uuid FOR UPDATE`;
    acquired.resolve();
    await release.promise;
    return first({ run: (work) => work(tx) });
  });
  const winnerResult = Promise.allSettled([winner]);
  let results = winnerResult;
  try {
    await Promise.race([acquired.promise, winner]);
    const loser = second({
      run: (work, options) =>
        f.transactions.run(async (tx) => {
          const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          contender.resolve(pid);
          return work(tx);
        }, options),
    });
    results = Promise.allSettled([winner, loser]);
    const pid = await Promise.race([contender.promise, loser]);
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const {
        rows: [{ blocked }],
      } = await f.client.query(
        "SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked",
        [pid],
      );
      if (blocked) {
        release.resolve();
        return await results;
      }
    }
    assert.fail("Contending operation did not wait for the Material row lock");
  } finally {
    release.resolve();
    await results;
  }
}
