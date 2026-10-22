import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { seedPathFeePolicies } from "../../dist/modules/credit/application/seed-fee-policies.js";
import { createMaterialFixture } from "./fixture.mjs";

test("material catalog plumbing on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const owner = await f.account();
    const staff = await f.account("STAFF");
    await t.test("roles receive material permissions", () => {
      assert.ok(owner.principal.permissions.includes("material:create:self"));
      assert.ok(owner.principal.permissions.includes("material:access"));
      assert.ok(!owner.principal.permissions.includes("material:moderate"));
      assert.ok(staff.principal.permissions.includes("material:moderate"));
    });
    await t.test("MATERIAL_PAID 5% policy is seeded once", async () => {
      // The fixture already seeded once; a second run must be a no-op.
      await f.transactions.run(seedPathFeePolicies);
      const policies = await f.db.feePolicyVersion.findMany({
        where: { policyCode: "MATERIAL_PAID" },
      });
      assert.equal(policies.length, 1);
      assert.deepEqual(policies[0].calculationRule, { feeBps: 500 });
      assert.equal(policies[0].status, "APPROVED");
    });
    const base = {
      ownerId: owner.user.id,
      skillId: f.skill.id,
      title: "Docker basics",
      description: "Ten or more characters",
      listingVersion: 1,
      moderationStatus: "NONE",
      status: "DRAFT",
    };
    await t.test("price must match access type", async () => {
      await assert.rejects(
        f.db.material.create({
          data: {
            ...base,
            id: randomUUID(),
            accessType: "FREE",
            priceCredit: 100n,
          },
        }),
        /materials_price_by_access_check/,
      );
      await assert.rejects(
        f.db.material.create({
          data: {
            ...base,
            id: randomUUID(),
            accessType: "PAID",
            priceCredit: 0n,
          },
        }),
        /materials_price_by_access_check/,
      );
    });
    await t.test(
      "PUBLISHED requires a clean rights-confirmed file",
      async () => {
        await assert.rejects(
          f.db.material.create({
            data: {
              ...base,
              id: randomUUID(),
              accessType: "FREE",
              priceCredit: 0n,
              status: "PUBLISHED",
            },
          }),
          /materials_published_file_check/,
        );
      },
    );
  } finally {
    await f.dispose();
  }
});
