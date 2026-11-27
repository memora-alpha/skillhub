import type { Prisma } from "../../../generated/prisma/client";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import {
  DEFAULT_PLAN_ENTITLEMENTS,
  parsePlanEntitlements,
  type SubscriptionPlanCode,
} from "../domain/plan-entitlements";

/**
 * Proposed V1 plans (policies.md Q1, pending PO approval G3). Prices are Credit hundredths:
 * Creator 99 / 950, Pro 299 / 2,870 per month / year.
 */
const PLANS: {
  planCode: SubscriptionPlanCode;
  monthPrice: bigint;
  yearPrice: bigint;
}[] = [
  { planCode: "CREATOR", monthPrice: 9_900n, yearPrice: 95_000n },
  { planCode: "PRO", monthPrice: 29_900n, yearPrice: 287_000n },
];

export type SeededPlan = {
  planCode: SubscriptionPlanCode;
  planVersionId: string;
};

/**
 * Dev/demo seed: approves version 1 of every plan that has no version at all, effective now,
 * created and approved by the earliest active Admin. A plan with any version (draft, approved
 * or retired) belongs to Admin management and is never touched, so reruns change nothing.
 * Production plans go through the audited admin routes instead.
 */
export async function seedSubscriptionPlans(
  tx: TransactionContext,
): Promise<SeededPlan[]> {
  const [clock] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT CURRENT_TIMESTAMP AS now`;
  if (!(clock?.now instanceof Date))
    throw new Error("subscription plan seed could not read database time");
  const admin = await tx.user.findFirst({
    where: { accountStatus: "ACTIVE", roleIdRecord: { code: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!admin)
    throw new Error(
      "subscription plan seed needs an active ADMIN account; bootstrap one first",
    );
  const seeded: SeededPlan[] = [];
  for (const plan of PLANS) {
    // Sequential on purpose: each plan is checked and created on its own.
    const existing = await tx.subscriptionPlanVersion.findFirst({
      where: { planCode: plan.planCode },
      select: { id: true },
    });
    if (existing) continue;
    const created = await tx.subscriptionPlanVersion.create({
      data: {
        ...plan,
        versionNo: 1,
        entitlements: parsePlanEntitlements(
          DEFAULT_PLAN_ENTITLEMENTS[plan.planCode],
        ) as Prisma.InputJsonObject,
        status: "APPROVED",
        effectiveAt: clock.now,
        approvedAt: clock.now,
        approvedByUserId: admin.id,
        createdByUserId: admin.id,
      },
      select: { id: true },
    });
    seeded.push({ planCode: plan.planCode, planVersionId: created.id });
  }
  return seeded;
}
