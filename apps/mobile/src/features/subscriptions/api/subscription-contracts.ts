import { z } from "zod";
import { timestamp, uuid, version } from "@/lib/http/contracts";

export const planCodeSchema = z.enum(["CREATOR", "PRO"]);
export const intervalSchema = z.enum(["MONTH", "YEAR"]);
export const creditSchema = z.string().regex(/^(?:0|[1-9]\d{0,12})\.\d{2}$/);
const bytes = z.string().regex(/^(?:0|[1-9]\d{0,15})$/);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const entitlementsSchema = z.object({
  feeTier: planCodeSchema.nullable(),
  materialStorageBytes: bytes,
  whiteboardRetentionDays: z.number().int().positive(),
  recordingMinutesPerPeriod: count,
  recordingRetentionDays: z.number().int().positive(),
  recordingAddonAllowed: z.boolean(),
});
export const planSchema = z.object({
  planCode: planCodeSchema,
  planVersionId: uuid,
  versionNo: version,
  monthPrice: creditSchema,
  yearPrice: creditSchema,
  entitlements: entitlementsSchema,
  effectiveAt: timestamp,
});
export const subscriptionSchema = z.object({
  id: uuid,
  planCode: planCodeSchema,
  planVersionId: uuid,
  interval: intervalSchema,
  status: z.enum(["ACTIVE", "GRACE", "EXPIRED"]),
  autoRenew: z.boolean(),
  termStart: timestamp,
  termEnd: timestamp,
  graceUntil: timestamp.nullable(),
  scheduledPlanCode: planCodeSchema.nullable(),
  scheduledInterval: intervalSchema.nullable(),
  version,
});
export const membershipSchema = z.object({
  subscription: subscriptionSchema.nullable(),
  entitlements: entitlementsSchema,
  usage: z
    .object({
      periodStart: timestamp,
      periodEnd: timestamp,
      recordingMinutesAllowed: count,
      recordingMinutesUsed: count,
      addonMinutesRemaining: count,
    })
    .nullable(),
  materialStorage: z.object({
    usedBytes: bytes,
    allowedBytes: bytes,
    enforced: z.boolean(),
  }),
});
export const quoteSchema = z.object({
  planCode: planCodeSchema,
  planVersionId: uuid,
  amount: creditSchema,
  termEnd: timestamp,
  quotedAt: timestamp,
  version,
});
export const updateSchema = z
  .object({
    expectedVersion: version,
    autoRenew: z.boolean().optional(),
    scheduledPlanCode: planCodeSchema.nullable().optional(),
    scheduledInterval: intervalSchema.nullable().optional(),
  })
  .strict();
export const chargeSchema = z.object({
  id: uuid,
  kind: z.enum(["PURCHASE", "UPGRADE", "RENEWAL", "RECORDING_ADDON"]),
  planCode: planCodeSchema,
  amount: creditSchema,
  quantity: z.number().int().positive(),
  createdAt: timestamp,
});
export const purchaseSchema = z
  .object({
    planCode: planCodeSchema,
    interval: intervalSchema,
    expectedPlanVersionId: uuid,
  })
  .strict();
export const upgradeSchema = z
  .object({
    planCode: planCodeSchema,
    expectedPlanVersionId: uuid,
    expectedAmount: creditSchema,
    expectedVersion: version,
  })
  .strict();
export const commandSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("purchase"),
      body: purchaseSchema,
      amount: creditSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("upgrade"),
      body: upgradeSchema,
      amount: creditSchema,
    })
    .strict(),
]);
export const intentSchema = z
  .object({ key: uuid, command: commandSchema })
  .strict();
export type Plan = z.infer<typeof planSchema>;
export type PlanCode = z.infer<typeof planCodeSchema>;
export type Interval = z.infer<typeof intervalSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type Subscription = z.infer<typeof subscriptionSchema>;
export type UpgradeQuote = z.infer<typeof quoteSchema>;
export type SubscriptionUpdate = z.infer<typeof updateSchema>;
export type SubscriptionCommand = z.infer<typeof commandSchema>;
export type SubscriptionIntent = z.infer<typeof intentSchema>;
