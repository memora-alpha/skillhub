import type {
  EffectivePlanCode,
  PlanEntitlements,
} from "../../domain/plan-entitlements";

/** What other modules read about a user's plan (spec 021 data-model "Ownership"). */
export type UserEntitlements = {
  userId: string;
  planCode: EffectivePlanCode;
  /** The subscription that grants the plan; null for FREE. */
  subscriptionId: string | null;
  entitlements: PlanEntitlements;
};
