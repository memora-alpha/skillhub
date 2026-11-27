// Shared PostgreSQL fixture for the spec 021 integration suites (isolated, migrated schema).
import { randomUUID } from "node:crypto";
import {
  DEFAULT_FREE_ENTITLEMENTS,
  DEFAULT_PLAN_ENTITLEMENTS,
} from "../../dist/modules/subscriptions/domain/plan-entitlements.js";
import { SubscriptionEntitlementsReader } from "../../dist/modules/subscriptions/application/services/subscription-entitlements.reader.js";
import { SubscriptionPlansService } from "../../dist/modules/subscriptions/application/services/subscription-plans.service.js";
import { SubscriptionRenewalService } from "../../dist/modules/subscriptions/application/services/subscription-renewal.service.js";
import { SubscriptionsService } from "../../dist/modules/subscriptions/application/services/subscriptions.service.js";
import { createMaterialFixture } from "../materials/fixture.mjs";

export const DAY = 86_400_000;

/** A principal allowed to buy plans, whatever the seeded role catalog grants. */
export const buyer = (account) => ({
  ...account.principal,
  permissions: [
    ...new Set([...account.principal.permissions, "subscription:manage:self"]),
  ],
});

export async function subscriptionFixture() {
  const f = await createMaterialFixture();
  try {
    const values = {
      "subscription.enabled": true,
      "subscription.freeEntitlements": DEFAULT_FREE_ENTITLEMENTS,
      "subscription.graceDays": 3,
      "subscription.renewalRetryHours": 24,
      "subscription.recordingAddon": { minutes: 60, priceCredit: 30 },
    };
    const configuration = {
      values,
      getSnapshot: async (keys) => ({
        values: Object.fromEntries(keys.map((key) => [key, values[key]])),
      }),
    };
    const reader = new SubscriptionEntitlementsReader(configuration);
    const plans = new SubscriptionPlansService(f.transactions, f.audit);
    const service = new SubscriptionsService(
      f.transactions,
      f.commands,
      f.credits,
      f.audit,
      configuration,
      plans,
      reader,
    );
    const renewals = new SubscriptionRenewalService(
      f.transactions,
      f.credits,
      f.audit,
      configuration,
      plans,
    );
    const admin = await f.account("ADMIN");
    const past = new Date(Date.now() - DAY);
    const version = (planCode, monthPrice, yearPrice, entitlements = {}) =>
      f.db.subscriptionPlanVersion.create({
        data: {
          planCode,
          versionNo: 1,
          monthPrice,
          yearPrice,
          entitlements: {
            ...DEFAULT_PLAN_ENTITLEMENTS[planCode],
            ...entitlements,
          },
          status: "APPROVED",
          effectiveAt: past,
          approvedAt: past,
          approvedByUserId: admin.user.id,
          createdByUserId: admin.user.id,
        },
      });
    const creator = await version("CREATOR", 9_900n, 95_000n, {
      materialStorageBytes: "3000",
    });
    const pro = await version("PRO", 29_900n, 287_000n);
    const purchase = (account, key = randomUUID(), planCode = "CREATOR") =>
      service.purchase(
        buyer(account),
        {
          planCode,
          interval: "MONTH",
          expectedPlanVersionId: planCode === "PRO" ? pro.id : creator.id,
        },
        key,
      );
    const wallet = async (account) =>
      (
        await f.db.creditWallet.findUnique({
          where: { userId: account.user.id },
        })
      )?.availableCredit ?? 0n;
    return {
      ...f,
      values,
      reader,
      plans,
      service,
      renewals,
      creator,
      pro,
      purchase,
      wallet,
    };
  } catch (error) {
    // A failed setup must not leak the schema or pool handles.
    await f.dispose();
    throw error;
  }
}
