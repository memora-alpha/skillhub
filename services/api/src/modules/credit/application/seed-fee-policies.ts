import type { TransactionContext } from "../../../infrastructure/database/transaction-context";

const POLICIES = [
  // The SRS fixes the 96/4 split; the product owner selected floor rounding.
  {
    policyCode: "ONE_WAY",
    calculationRule: { returnedBps: 9600, feeBps: 400 },
  },
  {
    policyCode: "TWO_WAY",
    calculationRule: { returnedBps: 9600, feeBps: 400 },
  },
  // OP-14 decided 2026-10-21: 5% material sale fee, seller keeps gross minus the floored fee.
  { policyCode: "MATERIAL_PAID", calculationRule: { feeBps: 500 } },
] as const;

/** Seeds v1 of every fee policy that has no APPROVED version yet. */
export async function seedPathFeePolicies(
  tx: TransactionContext,
): Promise<void> {
  const [clock] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT CURRENT_TIMESTAMP AS now`;
  if (!(clock?.now instanceof Date))
    throw new Error("fee policy seed could not read database time");
  for (const { policyCode, calculationRule } of POLICIES) {
    const approved = await tx.feePolicyVersion.findFirst({
      where: { policyCode, status: "APPROVED" },
      select: { id: true },
    });
    if (approved) continue;
    const baseline = await tx.feePolicyVersion.findUnique({
      where: { policyCode_versionNo: { policyCode, versionNo: 1 } },
      select: { id: true },
    });
    if (baseline)
      throw new Error(`fee policy requires reconciliation: ${policyCode}`);
    await tx.feePolicyVersion.create({
      data: {
        policyCode,
        versionNo: 1,
        calculationRule,
        roundingRule: { mode: "DOWN", precision: 2 },
        status: "APPROVED",
        approvedAt: clock.now,
        effectiveAt: clock.now,
      },
    });
  }
}
