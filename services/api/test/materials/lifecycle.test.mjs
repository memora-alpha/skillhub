import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateMaterialDto } from "../../dist/modules/materials/presentation/http/materials.dto.js";
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
      material = await f.materials.submit(owner.principal, material.id);
      assert.equal(material.status, "PENDING_REVIEW");
      assert.equal(material.moderationStatus, "PENDING");
      const mine = await f.materials.listMine(owner.principal);
      assert.deepEqual(
        mine.map((m) => m.id),
        [material.id],
      );
    });
    await t.test("archive stops distribution and blocks edits", async () => {
      material = await f.materials.archive(owner.principal, material.id);
      assert.equal(material.status, "ARCHIVED");
      await assert.rejects(
        f.materials.update(owner.principal, material.id, {
          expectedListingVersion: 2,
          title: "New title",
        }),
        /MATERIAL_NOT_EDITABLE/,
      );
    });
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
        assert.ok(queue.some((m) => m.id === live.id));
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
  } finally {
    await f.dispose();
  }
});
