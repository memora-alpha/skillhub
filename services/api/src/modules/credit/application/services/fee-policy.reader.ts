import type { FeePolicyVersion } from "../../../../generated/prisma/client";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  feePolicyLookupOrder,
  type BaseFeePolicyCode,
  type FeeTier,
} from "../../domain/fee-policy-codes";

/**
 * Effective approved fee policy at `at` for a base series and an optional plan tier
 * (spec 021 D8). The tier series is used when it has an effective version; otherwise the
 * base series, so a missing tier policy never blocks scheduling or a purchase.
 */
export async function effectiveFeePolicy(
  tx: TransactionContext,
  base: BaseFeePolicyCode,
  tier: FeeTier | null,
  at: Date,
): Promise<FeePolicyVersion | null> {
  // Sequential on purpose: the base lookup runs only when the tier series has no version.
  for (const policyCode of feePolicyLookupOrder(base, tier)) {
    const policy = await tx.feePolicyVersion.findFirst({
      where: {
        policyCode,
        status: "APPROVED",
        approvedAt: { not: null },
        effectiveAt: { lte: at },
      },
      orderBy: [{ effectiveAt: "desc" }, { versionNo: "desc" }],
    });
    if (policy) return policy;
  }
  return null;
}
