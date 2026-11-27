/** Fee policy series. Tier codes (spec 021 D8) are separate versioned series per plan. */
export const BASE_FEE_POLICY_CODES = [
  "ONE_WAY",
  "TWO_WAY",
  "MATERIAL_PAID",
] as const;
export const FEE_TIERS = ["CREATOR", "PRO"] as const;
export const FEE_POLICY_CODES = [
  ...BASE_FEE_POLICY_CODES,
  "ONE_WAY_CREATOR",
  "ONE_WAY_PRO",
  "MATERIAL_PAID_CREATOR",
  "MATERIAL_PAID_PRO",
] as const;

export type BaseFeePolicyCode = (typeof BASE_FEE_POLICY_CODES)[number];
export type FeeTier = (typeof FEE_TIERS)[number];
export type FeePolicyCode = (typeof FEE_POLICY_CODES)[number];

export function isFeePolicyCode(value: unknown): value is FeePolicyCode {
  return FEE_POLICY_CODES.includes(value as FeePolicyCode);
}

/** Tier policy code to try first; TWO_WAY never has a tier. */
export function tierFeePolicyCode(
  base: BaseFeePolicyCode,
  tier: FeeTier | null,
): FeePolicyCode {
  if (tier === null || base === "TWO_WAY") return base;
  return `${base}_${tier}`;
}

/** The base series of a code, for exchange-type and rule-shape checks. */
export function baseFeePolicyCode(code: string): string {
  return code.replace(/_(?:CREATOR|PRO)$/, "");
}

/** Codes to look up in order: the tier code, then the base code as fallback. */
export function feePolicyLookupOrder(
  base: BaseFeePolicyCode,
  tier: FeeTier | null,
): FeePolicyCode[] {
  const first = tierFeePolicyCode(base, tier);
  return first === base ? [base] : [first, base];
}
