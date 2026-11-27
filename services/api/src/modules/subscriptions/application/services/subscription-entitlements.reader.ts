import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import type { FeeTier } from "../../../credit/domain/fee-policy-codes";
import { grantsEntitlements } from "../../domain/subscription.policy";
import type { UserEntitlements } from "../contracts/subscription-entitlements";
import { databaseNow, versionEntitlements } from "./subscription-support";

/**
 * Exported read contract (spec 021 plan "Module design"). Reads inside the caller's
 * transaction so a purchase or expiry is either fully visible to the check or not at all.
 * It does not look at `subscription.enabled`: the flag stops sales, not paid terms.
 */
@Injectable()
export class SubscriptionEntitlementsReader {
  constructor(private readonly configuration: SystemConfigurationService) {}

  async forUser(
    tx: TransactionContext,
    userId: string,
    at?: Date,
  ): Promise<UserEntitlements> {
    const [result] = await this.forUsers(tx, [userId], at);
    return result!;
  }

  /**
   * Spec 021 D8: the fee tier of a user's current plan, or null for the base fee. Reads no
   * configuration, so fee pinning never depends on subscription settings being seeded.
   */
  async feeTier(
    tx: TransactionContext,
    userId: string,
    at: Date,
  ): Promise<FeeTier | null> {
    const row = await tx.userSubscription.findFirst({
      where: { userId, status: { in: ["ACTIVE", "GRACE"] } },
      include: { planVersion: true },
    });
    if (!row || !grantsEntitlements(row, at)) return null;
    return versionEntitlements(row.planVersion).feeTier;
  }

  /** One query for every user; results follow the input order. */
  async forUsers(
    tx: TransactionContext,
    userIds: readonly string[],
    at?: Date,
  ): Promise<UserEntitlements[]> {
    if (userIds.length === 0) return [];
    const now = at ?? (await databaseNow(tx));
    const unique = new Set(userIds);
    const rows = await tx.userSubscription.findMany({
      where: {
        userId: { in: [...unique] },
        status: { in: ["ACTIVE", "GRACE"] },
      },
      include: { planVersion: true },
    });
    const current = new Map(
      rows
        .filter((row) => grantsEntitlements(row, now))
        .map((row) => [row.userId, row]),
    );
    const free =
      current.size === unique.size
        ? null
        : (
            await this.configuration.getSnapshot(
              ["subscription.freeEntitlements"],
              tx,
            )
          ).values["subscription.freeEntitlements"];
    return userIds.map((userId) => {
      const row = current.get(userId);
      if (row)
        return {
          userId,
          planCode: row.planCode,
          subscriptionId: row.id,
          entitlements: versionEntitlements(row.planVersion),
        };
      return {
        userId,
        planCode: "FREE" as const,
        subscriptionId: null,
        entitlements: free!,
      };
    });
  }
}
