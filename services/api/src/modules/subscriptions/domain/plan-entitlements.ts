import { z } from "zod";

/** Spec 021 D1: FREE is the absence of an active subscription, not a stored plan. */
export const SUBSCRIPTION_PLAN_CODES = ["CREATOR", "PRO"] as const;
export type SubscriptionPlanCode = (typeof SUBSCRIPTION_PLAN_CODES)[number];
export type EffectivePlanCode = SubscriptionPlanCode | "FREE";

/** Bytes are a decimal string so values above 2^53 survive JSON. */
const byteCount = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,15})$/, "materialStorageBytes must be whole bytes");

/**
 * What a plan unlocks (spec 021 D8–D14). `feeTier` null means the base fee policy.
 * Ranges match the configuration keys the values replace.
 */
export const planEntitlementsSchema = z
  .object({
    feeTier: z.enum(SUBSCRIPTION_PLAN_CODES).nullable(),
    materialStorageBytes: byteCount,
    whiteboardRetentionDays: z.number().int().min(8).max(3650),
    recordingMinutesPerPeriod: z.number().int().min(0).max(100_000),
    recordingRetentionDays: z.number().int().min(1).max(3650),
    recordingAddonAllowed: z.boolean(),
  })
  .strict();

export type PlanEntitlements = z.output<typeof planEntitlementsSchema>;

/** Default FREE values (policies.md, awaiting Q1 approval). */
export const DEFAULT_FREE_ENTITLEMENTS: PlanEntitlements = {
  feeTier: null,
  materialStorageBytes: "1000000000",
  whiteboardRetentionDays: 30,
  recordingMinutesPerPeriod: 0,
  recordingRetentionDays: 30,
  recordingAddonAllowed: false,
};

/** Default paid values used to draft the first plan versions (policies.md Q1). */
export const DEFAULT_PLAN_ENTITLEMENTS: Record<
  SubscriptionPlanCode,
  PlanEntitlements
> = {
  CREATOR: {
    feeTier: "CREATOR",
    materialStorageBytes: "10000000000",
    whiteboardRetentionDays: 180,
    recordingMinutesPerPeriod: 120,
    recordingRetentionDays: 30,
    recordingAddonAllowed: true,
  },
  PRO: {
    feeTier: "PRO",
    materialStorageBytes: "50000000000",
    whiteboardRetentionDays: 365,
    recordingMinutesPerPeriod: 400,
    recordingRetentionDays: 90,
    recordingAddonAllowed: true,
  },
};

/** Plan order for upgrade checks: a higher rank is an upgrade. */
export const PLAN_RANK: Record<EffectivePlanCode, number> = {
  FREE: 0,
  CREATOR: 1,
  PRO: 2,
};

export function parsePlanEntitlements(input: unknown): PlanEntitlements {
  return planEntitlementsSchema.parse(input);
}

/** Recording is available when a plan grants period minutes or add-on purchases. */
export function includesRecording(entitlements: PlanEntitlements): boolean {
  return (
    entitlements.recordingMinutesPerPeriod > 0 ||
    entitlements.recordingAddonAllowed
  );
}
