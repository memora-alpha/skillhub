import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createMaterialFixture } from "./fixture.mjs";

test("material reports on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const seller = await f.account();
    const buyer = await f.account();
    const stranger = await f.account();
    await f.fund(buyer, 5000n);
    const paid = await f.publishedMaterial(seller, {
      accessType: "PAID",
      priceCredit: "10",
    });
    const { order } = await f.purchases.purchase(
      buyer.principal,
      paid.id,
      paid.listingVersion,
      randomUUID(),
    );
    const input = {
      reasonCode: "INAPPROPRIATE_CONTENT",
      description: "Contains copied slides",
    };
    await t.test(
      "buyer report links the order without path or session",
      async () => {
        const report = await f.reports.report(buyer.principal, paid.id, input);
        assert.equal(report.relatedOrderId, order.id);
        const row = await f.db.reportCase.findUniqueOrThrow({
          where: { id: report.id },
        });
        assert.equal(row.targetType, "MATERIAL");
        assert.equal(row.relatedMaterialId, paid.id);
        assert.equal(row.relatedPathId, null);
        assert.equal(row.blocksSettlement, false);
        // The staff queue reads the database; no unconsumed outbox event is written.
        assert.equal(
          await f.db.outboxEvent.count({ where: { aggregateId: report.id } }),
          0,
        );
      },
    );
    await t.test("one active report per reporter and material", async () => {
      await assert.rejects(
        f.reports.report(buyer.principal, paid.id, input),
        /ACTIVE_MATERIAL_REPORT_EXISTS/,
      );
    });
    await t.test(
      "concurrent reports from one reporter create a single case",
      async () => {
        const racer = await f.account();
        const results = await Promise.allSettled([
          f.reports.report(racer.principal, paid.id, input),
          f.reports.report(racer.principal, paid.id, input),
        ]);
        assert.equal(
          results.filter((result) => result.status === "fulfilled").length,
          1,
        );
        assert.equal(
          await f.db.reportCase.count({
            where: { reporterId: racer.user.id, relatedMaterialId: paid.id },
          }),
          1,
        );
      },
    );
    await t.test("reporting requires material:access", async () => {
      await assert.rejects(
        f.reports.report({ ...stranger.principal, permissions: [] }, paid.id, {
          ...input,
        }),
        /MATERIAL_PERMISSION_REQUIRED/,
      );
    });
    await t.test(
      "a description under 10 characters after trimming is rejected",
      async () => {
        await assert.rejects(
          f.reports.report(stranger.principal, paid.id, {
            ...input,
            description: "   too short   ",
          }),
          /MATERIAL_TEXT_INVALID/,
        );
      },
    );
    await t.test(
      "non-buyers can report public listings but not hidden drafts",
      async () => {
        const report = await f.reports.report(
          stranger.principal,
          paid.id,
          input,
        );
        assert.equal(report.relatedOrderId, null);
        const draft = await f.materials.create(
          seller.principal,
          f.draftInput(),
        );
        await assert.rejects(
          f.reports.report(stranger.principal, draft.id, input),
          /MATERIAL_NOT_FOUND/,
        );
      },
    );
  } finally {
    await f.dispose();
  }
});
