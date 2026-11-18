import assert from "node:assert/strict";
import { test } from "node:test";
import { createMaterialFixture } from "./fixture.mjs";

test("material filters, private library cursors and moderation history on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const owner = await f.account();
    const otherOwner = await f.account();
    const buyer = await f.account();
    const foreignBuyer = await f.account();
    const early = await f.publishedMaterial(owner, {
      title: "Kubernetes early guide",
    });
    const first = await f.publishedMaterial(owner, {
      title: "Kubernetes matching guide one",
    });
    const second = await f.publishedMaterial(owner, {
      title: "Kubernetes matching guide two",
    });
    const foreign = await f.publishedMaterial(otherOwner, {
      title: "Kubernetes matching foreign guide",
    });
    const at = new Date("2026-11-18T00:00:00.000Z");
    await f.db.material.updateMany({
      where: { id: { in: [first.id, second.id, foreign.id] } },
      data: { createdAt: at },
    });
    await f.db.material.update({
      where: { id: early.id },
      data: { createdAt: new Date("2026-10-01T00:00:00.000Z") },
    });
    const query = {
      q: "KUBERNETES",
      ownerId: owner.user.id,
      from: at.toISOString(),
      to: "2026-11-19T00:00:00.000Z",
    };

    await t.test(
      "catalog applies all filters and a half-open time range",
      async () => {
        const result = await f.catalog.search({ ...query, page: 1, limit: 50 });
        assert.equal(result.pagination.total, 2);
        assert.deepEqual(
          new Set(result.data.map((row) => row.id)),
          new Set([first.id, second.id]),
        );
        const excluded = await f.catalog.search({
          ...query,
          from: "2026-11-17T00:00:00.000Z",
          to: at.toISOString(),
          page: 1,
          limit: 50,
        });
        assert.equal(excluded.data.length, 0);
      },
    );

    await t.test(
      "saved filters run before page limits and cursors bind the filter",
      async () => {
        for (const material of [early, first, second, foreign])
          await f.favorites.add(buyer.principal, material.id);
        await f.favorites.add(foreignBuyer.principal, foreign.id);
        const pageOne = await f.favorites.list(buyer.principal, {
          ...query,
          limit: 1,
        });
        assert.equal(pageOne.data.length, 1);
        assert.equal(pageOne.pagination.hasMore, true);
        const pageTwo = await f.favorites.list(buyer.principal, {
          ...query,
          limit: 1,
          cursor: pageOne.pagination.nextCursor,
        });
        assert.equal(pageTwo.data.length, 1);
        assert.equal(pageTwo.pagination.hasMore, false);
        assert.notEqual(
          pageOne.data[0].material.id,
          pageTwo.data[0].material.id,
        );
        await assert.rejects(
          () =>
            f.favorites.list(buyer.principal, {
              ...query,
              q: "changed",
              cursor: pageOne.pagination.nextCursor,
            }),
          /INVALID_CURSOR/,
        );
        await assert.rejects(
          () =>
            f.favorites.list(foreignBuyer.principal, {
              ...query,
              cursor: pageOne.pagination.nextCursor,
            }),
          /INVALID_CURSOR/,
        );
      },
    );

    await t.test(
      "free download library filters use current public metadata before aggregation limit",
      async () => {
        await f.catalog.download(buyer.principal, first.id);
        await f.catalog.download(buyer.principal, second.id);
        await f.catalog.download(buyer.principal, foreign.id);
        const pageOne = await f.catalog.listFreeAccesses(buyer.principal, {
          ...query,
          skillId: f.skill.id,
          accessType: "FREE",
          limit: 1,
        });
        assert.equal(pageOne.data.length, 1);
        assert.equal(pageOne.pagination.hasMore, true);
        const pageTwo = await f.catalog.listFreeAccesses(buyer.principal, {
          ...query,
          skillId: f.skill.id,
          accessType: "FREE",
          limit: 1,
          cursor: pageOne.pagination.nextCursor,
        });
        assert.equal(pageTwo.data.length, 1);
        assert.equal(pageTwo.pagination.hasMore, false);
        assert.deepEqual(
          new Set([pageOne.data[0].material.id, pageTwo.data[0].material.id]),
          new Set([first.id, second.id]),
        );
        const paidOnly = await f.catalog.listFreeAccesses(buyer.principal, {
          ...query,
          skillId: f.skill.id,
          accessType: "PAID",
          limit: 1,
        });
        assert.equal(paidOnly.data.length, 0);
        assert.equal(paidOnly.pagination.hasMore, false);
      },
    );

    await t.test(
      "purchase library searches immutable snapshot title and seller inside buyer scope",
      async () => {
        await f.fund(buyer, 5000n);
        const paid = await f.publishedMaterial(owner, {
          title: "Purchased Kubernetes workbook",
          accessType: "PAID",
          priceCredit: "10",
        });
        await f.db.material.update({
          where: { id: paid.id },
          data: { createdAt: at },
        });
        const bought = await f.purchases.purchase(
          buyer.principal,
          paid.id,
          paid.listingVersion,
          "web-search-order",
        );
        const result = await f.purchases.listOrders(buyer.principal, {
          ...query,
          q: "PURCHASED KUBERNETES",
          accessType: "PAID",
          limit: 1,
        });
        assert.deepEqual(
          result.data.map((row) => row.id),
          [bought.order.id],
        );
        assert.equal(
          result.data[0].purchasedMaterial.title,
          "Purchased Kubernetes workbook",
        );
        const other = await f.purchases.listOrders(foreignBuyer.principal, {
          ...query,
          q: "PURCHASED KUBERNETES",
          accessType: "PAID",
        });
        assert.equal(other.data.length, 0);
      },
    );

    await t.test(
      "history preserves decision actor, version, reason and chronological paging",
      async () => {
        const hidden = await f.moderation.moderate(
          f.moderator.principal,
          first.id,
          "hide",
          {
            expectedListingVersion: first.listingVersion,
            reason: "Review requested",
          },
        );
        await f.moderation.moderate(f.moderator.principal, first.id, "unhide", {
          expectedListingVersion: hidden.listingVersion,
          reason: "Review cleared",
        });
        const one = await f.moderation.history(
          f.moderator.principal,
          first.id,
          { limit: 1 },
        );
        assert.equal(one.data[0].action, "unhide");
        assert.equal(one.data[0].actor.userId, f.moderator.user.id);
        assert.equal(one.data[0].reason, "Review cleared");
        assert.equal(one.data[0].listingVersion, hidden.listingVersion + 1);
        const two = await f.moderation.history(
          f.moderator.principal,
          first.id,
          { limit: 1, cursor: one.pagination.nextCursor },
        );
        assert.equal(two.data[0].action, "hide");
        assert.equal(two.data[0].reason, "Review requested");
        await assert.rejects(
          () => f.moderation.history(buyer.principal, first.id),
          /STAFF_ACCESS_REQUIRED/,
        );
      },
    );

    await t.test(
      "staff ALL searches mixed lifecycle states without exposing drafts",
      async () => {
        const draft = await f.materials.create(
          owner.principal,
          f.draftInput({ title: "Kubernetes private draft" }),
        );
        await f.materials.archive(
          owner.principal,
          early.id,
          early.listingVersion,
        );
        await f.moderation.moderate(f.moderator.principal, second.id, "hide", {
          expectedListingVersion: second.listingVersion,
          reason: "Staff all-state search",
        });
        const result = await f.moderation.queue(f.moderator.principal, "ALL", {
          q: "Kubernetes",
          ownerId: owner.user.id,
          limit: 100,
        });
        assert.ok(
          result.data.some(
            (row) => row.id === early.id && row.status === "ARCHIVED",
          ),
        );
        assert.ok(
          result.data.some(
            (row) => row.id === second.id && row.status === "HIDDEN",
          ),
        );
        assert.ok(
          result.data.some(
            (row) => row.id === first.id && row.status === "PUBLISHED",
          ),
        );
        assert.ok(
          result.data.every(
            (row) => row.id !== draft.id && row.status !== "DRAFT",
          ),
        );
      },
    );
  } finally {
    await f.dispose();
  }
});
