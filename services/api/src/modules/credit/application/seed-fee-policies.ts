import type { TransactionContext } from "../../../infrastructure/database/transaction-context";

/** The SRS fixes the 96/4 split; the product owner selected floor rounding. */
export async function seedPathFeePolicies(
  tx: TransactionContext,
): Promise<void> {
  const [clock] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT CURRENT_TIMESTAMP AS now`;
  if (!(clock?.now instanceof Date))
    throw new Error("fee policy seed could not read database time");
  for (const policyCode of ["ONE_WAY", "TWO_WAY"] as const) {
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
        calculationRule: { returnedBps: 9600, feeBps: 400 },
        roundingRule: { mode: "DOWN", precision: 2 },
        status: "APPROVED",
        approvedAt: clock.now,
        effectiveAt: clock.now,
      },
    });
  }
}
