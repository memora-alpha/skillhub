import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import type { FeeTier } from "../../../credit/domain/fee-policy-codes";
import { includesRecording } from "../../domain/plan-entitlements";
import {
  allocateRecordingMinutes,
  grantsEntitlements,
  recordedMinutes,
} from "../../domain/subscription.policy";
import type { PlanEntitlements } from "../../domain/plan-entitlements";
import type { UserEntitlements } from "../contracts/subscription-entitlements";
import {
  databaseNow,
  lockSubscriptionOwner,
  periodUsage,
  remainingRecordingMinutes,
  savePeriodUsage,
  versionEntitlements,
} from "./subscription-support";

/** What a recording request may use (spec 021 D11, D12). */
export type RecordingAllowance = {
  subscriptionId: string;
  retentionDays: number;
  remainingMinutes: number;
};

export type RecordingCharge = {
  charged: number;
  fromAllowance: number;
  fromAddon: number;
  absorbed: number;
};

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
    const paid = await this.paidEntitlements(tx, [userId], at);
    return paid.get(userId)?.feeTier ?? null;
  }

  /**
   * Entitlements of the users who hold a current paid plan at `at`; Free users are absent.
   * Reads no configuration, for callers whose Free value is their own module's setting.
   */
  async paidEntitlements(
    tx: TransactionContext,
    userIds: readonly string[],
    at: Date,
  ): Promise<Map<string, PlanEntitlements>> {
    if (userIds.length === 0) return new Map();
    const rows = await tx.userSubscription.findMany({
      where: {
        userId: { in: [...new Set(userIds)] },
        status: { in: ["ACTIVE", "GRACE"] },
      },
      include: { planVersion: true },
    });
    return new Map(
      rows
        .filter((row) => grantsEntitlements(row, at))
        .map((row) => [row.userId, versionEntitlements(row.planVersion)]),
    );
  }

  /**
   * Spec 021 D11: the requester's current plan when it includes recording, with the minutes
   * left in this period. Null when there is no such plan. Reads no configuration and
   * writes nothing.
   */
  async recordingAllowance(
    tx: TransactionContext,
    userId: string,
    at: Date,
  ): Promise<RecordingAllowance | null> {
    const row = await tx.userSubscription.findFirst({
      where: { userId, status: { in: ["ACTIVE", "GRACE"] } },
      include: { planVersion: true },
    });
    if (!row || !grantsEntitlements(row, at)) return null;
    const entitlements = versionEntitlements(row.planVersion);
    if (!includesRecording(entitlements)) return null;
    const usage = await periodUsage(tx, row, at);
    return {
      subscriptionId: row.id,
      retentionDays: entitlements.recordingRetentionDays,
      remainingMinutes: remainingRecordingMinutes(usage),
    };
  }

  /**
   * Spec 021 D11/D14: charges a finished recording, `ceil(durationMs / 60000)` minutes, to the
   * subscription pinned at its start: period allowance first, then add-on minutes; the rest
   * is absorbed. A subscription that
   * no longer grants entitlements at `at` absorbs everything. The caller guards against a
   * second charge for the same recording (`charged_minutes IS NULL`).
   */
  async chargeRecordingMinutes(
    tx: TransactionContext,
    subscriptionId: string,
    durationMs: bigint,
    at: Date,
  ): Promise<RecordingCharge> {
    const minutes = recordedMinutes(durationMs);
    const absorbedAll = {
      charged: 0,
      fromAllowance: 0,
      fromAddon: 0,
      absorbed: minutes,
    };
    if (minutes <= 0) return absorbedAll;
    const owner = await tx.userSubscription.findUnique({
      where: { id: subscriptionId },
      select: { userId: true },
    });
    if (!owner) return absorbedAll;
    // Same lock as purchases and add-on sales, so a period row is created once.
    await lockSubscriptionOwner(tx, owner.userId);
    const row = await tx.userSubscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      include: { planVersion: true },
    });
    // Minutes recorded before a renewal belong to a term that is already closed.
    if (!grantsEntitlements(row, at) || at < row.termStart) return absorbedAll;
    const usage = await periodUsage(tx, row, at);
    const split = allocateRecordingMinutes({
      minutes,
      allowed: usage.recordingMinutesAllowed,
      used: usage.recordingMinutesUsed,
      addonRemaining: usage.addonMinutesRemaining,
    });
    if (split.fromAllowance + split.fromAddon > 0)
      await savePeriodUsage(tx, row.id, {
        ...usage,
        recordingMinutesUsed: usage.recordingMinutesUsed + split.fromAllowance,
        addonMinutesRemaining: usage.addonMinutesRemaining - split.fromAddon,
      });
    return { charged: split.fromAllowance + split.fromAddon, ...split };
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
