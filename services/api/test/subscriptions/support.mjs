// Shared fake-database setup for the subscription suites.
import "reflect-metadata";
import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { AuditWriter } from "../../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../../dist/modules/audit/infrastructure/persistence/audit.repository.js";
import {
  DEFAULT_FREE_ENTITLEMENTS,
  DEFAULT_PLAN_ENTITLEMENTS,
} from "../../dist/modules/subscriptions/domain/plan-entitlements.js";
import { SubscriptionEntitlementsReader } from "../../dist/modules/subscriptions/application/services/subscription-entitlements.reader.js";
import { SubscriptionPlansService } from "../../dist/modules/subscriptions/application/services/subscription-plans.service.js";
import { SubscriptionsService } from "../../dist/modules/subscriptions/application/services/subscriptions.service.js";
import { SubscriptionRenewalService } from "../../dist/modules/subscriptions/application/services/subscription-renewal.service.js";
import { createFakeDb, runner } from "../learning-platform/fake-db.mjs";

export const U = "0a0a0a0a-0000-4000-8000-00000000000a";
export const V = "0b0b0b0b-0000-4000-8000-00000000000b";
export const ADMIN = "0d0d0d0d-0000-4000-8000-00000000000d";
export const DAY = 86_400_000;
export const START = new Date("2026-12-01T00:00:00.000Z");
export const self = (userId = U) => ({
  userId,
  roles: ["USER"],
  permissions: ["subscription:manage:self"],
});
export const admin = {
  userId: ADMIN,
  roles: ["ADMIN"],
  permissions: [
    "subscription:manage:self",
    "subscription:read",
    "subscription:manage",
  ],
};

/** Records idempotent results per key and checks the command fingerprint like the real service. */
function fakeIdempotency(db) {
  const completed = new Map();
  return {
    async execute(input, work) {
      const id = `${input.scope}:${input.operation}:${input.key}`;
      const command = JSON.stringify(input.command);
      const previous = completed.get(id);
      if (previous) {
        if (previous.command !== command)
          throw new ConflictException(input.conflictMessage);
        return { value: previous.value, replayed: true };
      }
      const value = await work(db);
      completed.set(id, { command, value });
      return { value, replayed: false };
    },
  };
}

/** Wallet debit with the real error code; ledger internals are covered by credit tests. */
function fakeCredit(db) {
  return {
    async chargeSubscription(_tx, { chargeId, userId, amount }) {
      const wallet = db
        .rows("creditWallet")
        .find((row) => row.userId === userId);
      if (!wallet || wallet.availableCredit < amount)
        throw new ConflictException("INSUFFICIENT_AVAILABLE_CREDIT");
      wallet.availableCredit -= amount;
      const operation = db.seed("creditOperation", {
        operationType: "SUBSCRIPTION_CHARGE",
        referenceType: "SUBSCRIPTION_CHARGE",
        referenceId: chargeId,
        idempotencyKey: `subscription-charge:${chargeId}`,
        status: "SUCCESS",
      });
      return { operationId: operation.id, lots: [] };
    },
  };
}

export function setup({ wallet = 100_000n, enabled = true } = {}) {
  const clock = { now: START };
  const db = createFakeDb({ now: () => clock.now });
  for (const userId of [U, V])
    db.seed("creditWallet", {
      userId,
      availableCredit: wallet,
      heldCredit: 0n,
      purchasedCredit: wallet,
      bonusCredit: 0n,
      walletVersion: 0,
    });
  const values = {
    "subscription.enabled": enabled,
    "subscription.freeEntitlements": DEFAULT_FREE_ENTITLEMENTS,
    "subscription.graceDays": 3,
    "subscription.renewalRetryHours": 24,
  };
  const configuration = {
    values,
    getSnapshot: async (keys) => ({
      values: Object.fromEntries(keys.map((key) => [key, values[key]])),
    }),
  };
  const audit = new AuditWriter(new AuditRepository());
  const plans = new SubscriptionPlansService(runner(db), audit);
  const reader = new SubscriptionEntitlementsReader(configuration);
  const service = new SubscriptionsService(
    runner(db),
    fakeIdempotency(db),
    fakeCredit(db),
    audit,
    configuration,
    plans,
    reader,
  );
  const renewals = new SubscriptionRenewalService(
    runner(db),
    fakeCredit(db),
    audit,
    configuration,
    plans,
  );
  const seedPlan = (planCode, monthPrice, yearPrice, extra = {}) =>
    db.seed("subscriptionPlanVersion", {
      planCode,
      versionNo: 1,
      monthPrice,
      yearPrice,
      entitlements: DEFAULT_PLAN_ENTITLEMENTS[planCode],
      status: "APPROVED",
      effectiveAt: new Date(START.getTime() - DAY),
      approvedAt: new Date(START.getTime() - DAY),
      approvedByUserId: ADMIN,
      createdByUserId: ADMIN,
      ...extra,
    });
  const creator = seedPlan("CREATOR", 9_900n, 95_000n);
  const pro = seedPlan("PRO", 29_900n, 287_000n);
  const wallets = () =>
    Object.fromEntries(
      db.rows("creditWallet").map((row) => [row.userId, row.availableCredit]),
    );
  return {
    db,
    clock,
    values,
    plans,
    reader,
    service,
    renewals,
    creator,
    pro,
    wallets,
  };
}

export const rejects = (promise, code) =>
  assert.rejects(promise, (error) => {
    assert.equal(error.message, code);
    return true;
  });

export const buy = (
  ctx,
  planCode = "CREATOR",
  key = "purchase-key-1",
  interval = "MONTH",
  user = U,
) =>
  ctx.service.purchase(
    self(user),
    {
      planCode,
      interval,
      expectedPlanVersionId: planCode === "PRO" ? ctx.pro.id : ctx.creator.id,
    },
    key,
  );

/**
 * Seeds a current plan for `userId` directly, for suites that only read plans (whiteboard,
 * recording). `entitlements` overrides the plan defaults.
 */
export function seedSubscription(db, userId, planCode, termEnd, options = {}) {
  const version = db.seed("subscriptionPlanVersion", {
    planCode,
    versionNo: 1,
    monthPrice: 9_900n,
    yearPrice: 95_000n,
    entitlements: {
      ...DEFAULT_PLAN_ENTITLEMENTS[planCode],
      ...options.entitlements,
    },
    status: "APPROVED",
    effectiveAt: new Date("2026-10-01T00:00:00Z"),
    approvedAt: new Date("2026-10-01T00:00:00Z"),
    createdByUserId: userId,
  });
  return db.seed("userSubscription", {
    userId,
    planCode,
    planVersionId: version.id,
    interval: "MONTH",
    status: options.status ?? "ACTIVE",
    termStart: options.termStart ?? new Date("2026-10-15T00:00:00Z"),
    termEnd,
    graceUntil: options.graceUntil ?? null,
  });
}
