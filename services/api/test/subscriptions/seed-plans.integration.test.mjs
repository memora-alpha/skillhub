// Spec 021: the dev/demo plan seed on an isolated PostgreSQL schema.
import assert from "node:assert/strict";
import { test } from "node:test";
import { seedSubscriptionPlans } from "../../dist/modules/subscriptions/application/seed-subscription-plans.js";
import { SubscriptionPlansService } from "../../dist/modules/subscriptions/application/services/subscription-plans.service.js";
import { DEFAULT_PLAN_ENTITLEMENTS } from "../../dist/modules/subscriptions/domain/plan-entitlements.js";
import { createSkillFixture } from "../skills/helpers.mjs";

test("subscription plan seed on isolated PostgreSQL", async (t) => {
  const f = await createSkillFixture();
  try {
    const seed = () => f.transactions.run((tx) => seedSubscriptionPlans(tx));

    await t.test("needs an active Admin to own the plans", async () => {
      await assert.rejects(seed(), /needs an active ADMIN account/);
      assert.equal(await f.db.subscriptionPlanVersion.count(), 0);
    });

    const admin = await f.account("ADMIN");

    await t.test(
      "approves Creator and Pro once, then changes nothing",
      async () => {
        const first = await seed();
        assert.deepEqual(
          first.map((plan) => plan.planCode),
          ["CREATOR", "PRO"],
        );
        assert.deepEqual(await seed(), []);
        const rows = await f.db.subscriptionPlanVersion.findMany({
          orderBy: { planCode: "asc" },
        });
        assert.deepEqual(
          rows.map((row) => [
            row.planCode,
            row.versionNo,
            row.status,
            row.monthPrice,
            row.yearPrice,
            row.createdByUserId,
            row.approvedByUserId,
          ]),
          [
            [
              "CREATOR",
              1,
              "APPROVED",
              9_900n,
              95_000n,
              admin.user.id,
              admin.user.id,
            ],
            [
              "PRO",
              1,
              "APPROVED",
              29_900n,
              287_000n,
              admin.user.id,
              admin.user.id,
            ],
          ],
        );
        assert.deepEqual(
          rows[0].entitlements,
          DEFAULT_PLAN_ENTITLEMENTS.CREATOR,
        );
        // The public plan list serves them at once.
        const plans = await new SubscriptionPlansService(
          f.transactions,
          f.audit,
        ).listEffective();
        assert.deepEqual(
          plans.map((plan) => [plan.planCode, plan.monthPrice, plan.yearPrice]),
          [
            ["CREATOR", "99.00", "950.00"],
            ["PRO", "299.00", "2870.00"],
          ],
        );
      },
    );
  } finally {
    await f.dispose();
  }
});

test("the seed never touches a plan an Admin already manages", async () => {
  const f = await createSkillFixture();
  try {
    const admin = await f.account("ADMIN");
    await f.db.subscriptionPlanVersion.create({
      data: {
        planCode: "PRO",
        versionNo: 1,
        monthPrice: 49_900n,
        yearPrice: 499_000n,
        entitlements: DEFAULT_PLAN_ENTITLEMENTS.PRO,
        status: "DRAFT",
        createdByUserId: admin.user.id,
      },
    });
    const seeded = await f.transactions.run((tx) => seedSubscriptionPlans(tx));
    assert.deepEqual(
      seeded.map((plan) => plan.planCode),
      ["CREATOR"],
    );
    const pro = await f.db.subscriptionPlanVersion.findMany({
      where: { planCode: "PRO" },
    });
    assert.deepEqual(
      pro.map((row) => [row.status, row.monthPrice]),
      [["DRAFT", 49_900n]],
    );
  } finally {
    await f.dispose();
  }
});
