import type {
  Membership,
  Plan,
  SubscriptionIntent,
} from "../../src/features/subscriptions/api/subscription-contracts";

export const planId = "11111111-1111-4111-8111-111111111111";
export const proId = "22222222-2222-4222-8222-222222222222";
export const subscriptionId = "33333333-3333-4333-8333-333333333333";
export const intentKey = "44444444-4444-4444-8444-444444444444";
export const creator: Plan = {
  planCode: "CREATOR",
  planVersionId: planId,
  versionNo: 1,
  monthPrice: "99.00",
  yearPrice: "950.00",
  effectiveAt: "2026-11-27T00:00:00Z",
  entitlements: {
    feeTier: "CREATOR",
    materialStorageBytes: "10000000000",
    whiteboardRetentionDays: 180,
    recordingMinutesPerPeriod: 120,
    recordingRetentionDays: 30,
    recordingAddonAllowed: true,
  },
};
export const pro: Plan = {
  ...creator,
  planCode: "PRO",
  planVersionId: proId,
  monthPrice: "299.00",
  yearPrice: "2870.00",
  entitlements: {
    ...creator.entitlements,
    feeTier: "PRO",
    materialStorageBytes: "50000000000",
    whiteboardRetentionDays: 365,
    recordingMinutesPerPeriod: 400,
    recordingRetentionDays: 90,
  },
};
export const freeMembership: Membership = {
  subscription: null,
  usage: null,
  entitlements: {
    feeTier: null,
    materialStorageBytes: "1000000000",
    whiteboardRetentionDays: 30,
    recordingMinutesPerPeriod: 0,
    recordingRetentionDays: 30,
    recordingAddonAllowed: false,
  },
  materialStorage: {
    usedBytes: "420000000",
    allowedBytes: "1000000000",
    enforced: true,
  },
};
export const paidMembership: Membership = {
  subscription: {
    id: subscriptionId,
    planCode: "CREATOR",
    planVersionId: planId,
    interval: "MONTH",
    status: "ACTIVE",
    autoRenew: true,
    termStart: "2026-11-27T00:00:00Z",
    termEnd: "2026-12-27T00:00:00Z",
    graceUntil: null,
    scheduledPlanCode: null,
    scheduledInterval: null,
    version: 1,
  },
  entitlements: creator.entitlements,
  usage: {
    periodStart: "2026-11-27T00:00:00Z",
    periodEnd: "2026-12-27T00:00:00Z",
    recordingMinutesAllowed: 120,
    recordingMinutesUsed: 45,
    addonMinutesRemaining: 0,
  },
  materialStorage: {
    usedBytes: "2400000000",
    allowedBytes: "10000000000",
    enforced: true,
  },
};
export const purchaseIntent: SubscriptionIntent = {
  key: intentKey,
  command: {
    kind: "purchase",
    body: {
      planCode: "CREATOR",
      interval: "MONTH",
      expectedPlanVersionId: planId,
    },
    amount: "99.00",
  },
};
