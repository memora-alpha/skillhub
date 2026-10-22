import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createMaterialFixture } from "./fixture.mjs";

test("material search, preview and download rules on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const owner = await f.account();
    const reader = await f.account();
    const free = await f.publishedMaterial(owner, {
      title: "Kubernetes primer",
    });
    const paid = await f.publishedMaterial(owner, {
      title: "Paid Kubernetes deep dive",
      accessType: "PAID",
      priceCredit: "20",
    });
    const draft = await f.materials.create(
      owner.principal,
      f.draftInput({ title: "Secret draft" }),
    );
    /** Seeds a settled purchase (ledger, order snapshot, ACTIVE entitlement) until the purchase service exists. */
    async function sell(material) {
      const buyer = await f.account();
      await f.fund(buyer, 5000n);
      const orderId = randomUUID();
      const { operationId } = await f.transactions.run((tx) =>
        f.credits.purchaseMaterial(tx, {
          orderId,
          buyerId: buyer.user.id,
          sellerId: owner.user.id,
          gross: 2000n,
          fee: 100n,
        }),
      );
      const current = await f.db.material.findUniqueOrThrow({
        where: { id: material.id },
      });
      const policy = await f.db.feePolicyVersion.findFirstOrThrow({
        where: { policyCode: "MATERIAL_PAID", status: "APPROVED" },
      });
      await f.db.materialOrder.create({
        data: {
          id: orderId,
          buyerId: buyer.user.id,
          sellerId: owner.user.id,
          materialId: material.id,
          purchasedFileSnapshot: { storageKey: current.storageKey },
          listingVersion: current.listingVersion,
          grossCredit: 2000n,
          feeAmount: 100n,
          sellerNetCredit: 1900n,
          feePolicyId: policy.id,
          feeSnapshot: { feeBps: 500 },
          operationId,
          status: "SUCCESS",
          idempotencyKey: `fixture:${orderId}`,
        },
      });
      const entitlement = await f.db.materialEntitlement.create({
        data: {
          userId: buyer.user.id,
          materialId: material.id,
          sourceOrderId: orderId,
          sourceType: "PURCHASE",
          status: "ACTIVE",
          grantedAt: new Date(),
        },
      });
      return { buyer, entitlement, storageKey: current.storageKey };
    }
    /** Owner edit, then Staff re-approval (D3: every edit of a live listing is re-reviewed). */
    async function edit(material, changes) {
      const current = await f.db.material.findUniqueOrThrow({
        where: { id: material.id },
      });
      return f.materials.update(owner.principal, material.id, {
        expectedListingVersion: current.listingVersion,
        distributionRightsConfirmed: true,
        ...changes,
      });
    }
    const approve = (edited) =>
      f.moderation.moderate(f.moderator.principal, edited.id, "approve", {
        expectedListingVersion: edited.listingVersion,
      });
    const served = (link, key) => link.url.endsWith(`key=${key}`);
    await t.test("search returns only PUBLISHED metadata", async () => {
      const result = await f.catalog.search({
        q: "kubernetes",
        page: 1,
        limit: 20,
      });
      assert.deepEqual(
        new Set(result.data.map((m) => m.id)),
        new Set([free.id, paid.id]),
      );
      assert.equal(result.pagination.total, 2);
      const body = JSON.stringify(result);
      assert.equal(body.includes("storageKey"), false);
      assert.equal(body.includes("fixture/"), false);
      const paidOnly = await f.catalog.search({
        accessType: "PAID",
        page: 1,
        limit: 20,
      });
      assert.deepEqual(
        paidOnly.data.map((m) => m.id),
        [paid.id],
      );
    });
    await t.test("detail hides unpublished materials", async () => {
      assert.equal((await f.catalog.detail(paid.id)).priceCredit, "20.00");
      await assert.rejects(f.catalog.detail(draft.id), /MATERIAL_NOT_FOUND/);
    });
    await t.test("FREE downloads with a short-lived URL", async () => {
      const link = await f.catalog.download(reader.principal, free.id);
      assert.match(link.url, /^https:\/\/fixture\.invalid\/private/);
      assert.ok(link.expiresAt instanceof Date);
    });
    await t.test(
      "PAID without entitlement is denied, owner is allowed",
      async () => {
        await assert.rejects(
          f.catalog.download(reader.principal, paid.id),
          /MATERIAL_ACCESS_DENIED/,
        );
        assert.ok((await f.catalog.download(owner.principal, paid.id)).url);
      },
    );
    await t.test(
      "an ACTIVE entitlement serves the purchased snapshot, REVOKED is denied",
      async () => {
        const { buyer, entitlement, storageKey } = await sell(paid);
        const link = await f.catalog.download(buyer.principal, paid.id);
        assert.ok(served(link, storageKey));
        await f.db.materialEntitlement.update({
          where: { id: entitlement.id },
          data: {
            status: "REVOKED",
            revokedAt: new Date(),
            revokedReason: "refund",
          },
        });
        await assert.rejects(
          f.catalog.download(buyer.principal, paid.id),
          /MATERIAL_ACCESS_DENIED/,
        );
      },
    );
    await t.test(
      "a buyer keeps the purchased file after the seller replaces it",
      async () => {
        const item = await f.publishedMaterial(owner, {
          title: "Replaced file material",
          accessType: "PAID",
          priceCredit: "20",
        });
        const { buyer, storageKey: original } = await sell(item);
        const next = await f.materialFile(owner);
        assert.notEqual(next.objectKey, original);
        const edited = await edit(item, { fileId: next.id });
        // PENDING_REVIEW after the edit (D3): the buyer must not lose what they paid for.
        assert.ok(
          served(await f.catalog.download(buyer.principal, item.id), original),
        );
        await approve(edited);
        assert.ok(
          served(await f.catalog.download(buyer.principal, item.id), original),
        );
        assert.ok(
          served(
            await f.catalog.download(owner.principal, item.id),
            next.objectKey,
          ),
        );
      },
    );
    await t.test(
      "an ACTIVE entitlement outranks a later switch to FREE and ARCHIVED",
      async () => {
        const item = await f.publishedMaterial(owner, {
          title: "PAID turned FREE material",
          accessType: "PAID",
          priceCredit: "20",
        });
        const { buyer, storageKey: original } = await sell(item);
        const next = await f.materialFile(owner);
        const edited = await edit(item, {
          accessType: "FREE",
          priceCredit: "0",
          fileId: next.id,
        });
        await approve(edited);
        // PUBLISHED FREE: the buyer still gets the purchased file, not the current one (D5).
        assert.ok(
          served(await f.catalog.download(buyer.principal, item.id), original),
        );
        assert.ok(
          served(
            await f.catalog.download(reader.principal, item.id),
            next.objectKey,
          ),
        );
        await f.materials.archive(owner.principal, item.id);
        // ARCHIVED stops FREE downloads (D9) but not the purchased file.
        assert.ok(
          served(await f.catalog.download(buyer.principal, item.id), original),
        );
        await assert.rejects(
          f.catalog.download(reader.principal, item.id),
          /MATERIAL_NOT_PUBLISHED/,
        );
      },
    );
    await t.test("HIDDEN blocks an entitled buyer too (D4)", async () => {
      const item = await f.publishedMaterial(owner, {
        title: "Hidden paid material",
        accessType: "PAID",
        priceCredit: "20",
      });
      const { buyer, storageKey } = await sell(item);
      await f.moderation.moderate(f.moderator.principal, item.id, "hide", {
        expectedListingVersion: item.listingVersion,
        reason: "Under review",
      });
      await assert.rejects(
        f.catalog.download(buyer.principal, item.id),
        /MATERIAL_NOT_PUBLISHED/,
      );
      assert.ok(
        served(await f.catalog.download(owner.principal, item.id), storageKey),
      );
      await f.moderation.moderate(f.moderator.principal, item.id, "unhide", {
        expectedListingVersion: item.listingVersion,
        reason: "Cleared",
      });
      assert.ok(
        served(await f.catalog.download(buyer.principal, item.id), storageKey),
      );
    });
    await t.test("HIDDEN blocks readers but not the moderator", async () => {
      await f.moderation.moderate(f.moderator.principal, free.id, "hide", {
        expectedListingVersion: free.listingVersion,
        reason: "Under review",
      });
      await assert.rejects(
        f.catalog.download(reader.principal, free.id),
        /MATERIAL_NOT_PUBLISHED/,
      );
      assert.ok((await f.catalog.download(f.moderator.principal, free.id)).url);
    });
    // Keep this subtest last: it disables a trigger and corrupts the shared PAID file.
    await t.test("a file that turned unsafe is not served", async () => {
      // The immutability trigger and the READY => CLEAN check forbid this edit, so
      // lift the trigger in this isolated schema to simulate out-of-band tampering
      // that leaves the bound file REJECTED/INFECTED.
      await f.db.$executeRawUnsafe(
        "ALTER TABLE stored_files DISABLE TRIGGER stored_files_guard_immutability",
      );
      await f.db.storedFile.updateMany({
        where: { resourceType: "MATERIAL", resourceId: paid.id },
        data: { state: "REJECTED", scanVerdict: "INFECTED" },
      });
      await assert.rejects(
        f.catalog.download(owner.principal, paid.id),
        /FILE_NOT_READY/,
      );
    });
  } finally {
    await f.dispose();
  }
});
