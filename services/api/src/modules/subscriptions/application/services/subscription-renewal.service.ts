import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  Prisma,
  SubscriptionPlanVersion,
  UserSubscription,
} from "../../../../generated/prisma/client";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import { fingerprintCommand } from "../../../../infrastructure/idempotency/idempotency.service";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import { CreditOperationsService } from "../../../credit/application/services/credit-operations.service";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import {
  decideAtTermEnd,
  graceElapsed,
  termEndFor,
} from "../../domain/subscription.policy";
import { SubscriptionPlansService } from "./subscription-plans.service";
import {
  auditContext,
  databaseNow,
  lockSubscriptionOwner,
  priceFor,
  sha256,
  subscriptionAudit,
} from "./subscription-support";

/** A claimed row is skipped by other workers for this long, then becomes due again. */
const CLAIM_LEASE_MS = 5 * 60_000;
const SYSTEM_ACTOR = { kind: "SYSTEM" as const, name: "subscription-renewal" };

export type RenewalOutcome =
  "RENEWED" | "GRACE" | "RETRY_LATER" | "EXPIRED" | "NOT_DUE" | "SKIPPED";

type ExpiryReason = "AUTO_RENEW_OFF" | "GRACE_ELAPSED" | "PLAN_UNAVAILABLE";

/**
 * Spec 021 D6/D7: renewal, grace and expiry at term end. Durable `next_renewal_attempt_at`
 * rows are the queue; SKIP LOCKED claims let several API instances share it. Renewals keep
 * running while `subscription.enabled` is off: the flag stops new sales, not agreed renewals.
 */
@Injectable()
export class SubscriptionRenewalService {
  private readonly logger = new Logger(SubscriptionRenewalService.name);

  constructor(
    private readonly transactions: TransactionRunner,
    private readonly credit: CreditOperationsService,
    private readonly audit: AuditWriter,
    private readonly configuration: SystemConfigurationService,
    private readonly plans: SubscriptionPlansService,
  ) {}

  async renewDue(limit = 20): Promise<number> {
    const ids = await this.transactions.run(async (tx) => {
      const due = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM user_subscriptions
        WHERE status IN ('ACTIVE', 'GRACE') AND next_renewal_attempt_at <= now()
        ORDER BY next_renewal_attempt_at, id LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
      if (due.length)
        await tx.userSubscription.updateMany({
          where: { id: { in: due.map((row) => row.id) } },
          data: { nextRenewalAttemptAt: new Date(Date.now() + CLAIM_LEASE_MS) },
        });
      return due.map((row) => row.id);
    });
    // Sequential on purpose: each row locks its owner and wallet in its own transaction.
    for (const id of ids) {
      try {
        await this.processOne(id);
      } catch {
        // The lease makes the row due again; never log Credit or user details here.
        this.logger.error("SUBSCRIPTION_RENEWAL_DEFERRED");
      }
    }
    return ids.length;
  }

  /** Idempotent: a repeated or concurrent call for the same term end changes nothing. */
  processOne(id: string): Promise<RenewalOutcome> {
    return this.transactions.run(async (tx) => {
      const initial = await tx.userSubscription.findUnique({
        where: { id },
        select: { userId: true },
      });
      if (!initial) return "SKIPPED";
      await lockSubscriptionOwner(tx, initial.userId);
      const row = await tx.userSubscription.findUniqueOrThrow({
        where: { id },
      });
      if (row.status === "EXPIRED") return "SKIPPED";
      const now = await databaseNow(tx);
      const settings = (
        await this.configuration.getSnapshot(
          ["subscription.graceDays", "subscription.renewalRetryHours"],
          tx,
        )
      ).values;
      const graceDays = settings["subscription.graceDays"];
      const retryMs = settings["subscription.renewalRetryHours"] * 3_600_000;
      const base = {
        status: row.status,
        autoRenew: row.autoRenew,
        termEnd: row.termEnd,
        graceUntil: row.graceUntil,
        graceDays,
        at: now,
      };
      const first = decideAtTermEnd({ ...base, canPay: true });
      if (first.action === "WAIT") {
        await this.reschedule(tx, row, row.termEnd);
        return "NOT_DUE";
      }
      if (first.action === "EXPIRE")
        return this.expire(
          tx,
          row,
          now,
          row.status === "GRACE" && graceElapsed(row.graceUntil, now)
            ? "GRACE_ELAPSED"
            : "AUTO_RENEW_OFF",
        );
      const target = await this.renewalTarget(tx, row, now);
      if (!target) return this.expire(tx, row, now, "PLAN_UNAVAILABLE");
      if (await this.tryRenew(tx, row, target, now)) return "RENEWED";
      const fallback = decideAtTermEnd({ ...base, canPay: false });
      if (fallback.action === "ENTER_GRACE")
        return this.enterGrace(
          tx,
          row,
          fallback.graceUntil,
          now,
          retryMs,
          target.price,
        );
      if (fallback.action === "EXPIRE")
        return this.expire(tx, row, now, "GRACE_ELAPSED");
      await this.reschedule(
        tx,
        row,
        minDate(new Date(now.getTime() + retryMs), row.graceUntil ?? now),
      );
      return "RETRY_LATER";
    });
  }

  /** Scheduled plan and interval apply at renewal, at the version effective now (D5, D7). */
  private async renewalTarget(
    tx: TransactionContext,
    row: UserSubscription,
    now: Date,
  ): Promise<{
    version: SubscriptionPlanVersion;
    interval: UserSubscription["interval"];
    price: bigint;
  } | null> {
    const planCode = row.scheduledPlanCode ?? row.planCode;
    const interval = row.scheduledInterval ?? row.interval;
    const version = await this.plans.effectiveVersion(tx, planCode, now);
    if (!version) return null;
    return { version, interval, price: priceFor(version, interval) };
  }

  /** Charges and renews; false when the wallet is short (the charge wrote nothing). */
  private async tryRenew(
    tx: TransactionContext,
    row: UserSubscription,
    target: NonNullable<
      Awaited<ReturnType<SubscriptionRenewalService["renewalTarget"]>>
    >,
    now: Date,
  ): Promise<boolean> {
    const chargeId = randomUUID();
    let operationId: string;
    try {
      ({ operationId } = await this.credit.chargeSubscription(tx, {
        chargeId,
        userId: row.userId,
        amount: target.price,
      }));
    } catch (error) {
      if (
        error instanceof ConflictException &&
        error.message === "INSUFFICIENT_AVAILABLE_CREDIT"
      )
        return false;
      throw error;
    }
    // The new term continues from the old term end; after a very late run it starts now,
    // so a renewal never buys a term that has already passed.
    const continued = termEndFor(row.termEnd, target.interval);
    const termStart = continued > now ? row.termEnd : now;
    const termEnd = termEndFor(termStart, target.interval);
    const updated = await tx.userSubscription.update({
      where: { id: row.id },
      data: {
        planCode: target.version.planCode,
        planVersionId: target.version.id,
        interval: target.interval,
        status: "ACTIVE",
        graceUntil: null,
        termStart,
        termEnd,
        nextRenewalAttemptAt: termEnd,
        scheduledPlanCode: null,
        scheduledInterval: null,
        version: { increment: 1 },
      },
    });
    const renewalKey = `renewal:${row.id}:${row.termEnd.toISOString()}`;
    await tx.subscriptionCharge.create({
      data: {
        id: chargeId,
        subscriptionId: row.id,
        userId: row.userId,
        kind: "RENEWAL",
        planVersionId: target.version.id,
        amount: target.price,
        quantity: 1,
        operationId,
        // Unique per user: a second renewal of the same term end cannot commit.
        idempotencyKey: sha256(`RENEWAL:${renewalKey}`),
        requestDigest: fingerprintCommand({
          subscriptionId: row.id,
          termEnd: row.termEnd.toISOString(),
        }),
      },
    });
    await this.record(tx, "SUBSCRIPTION_RENEW", row, updated, {
      amount: target.price,
      operationId,
    });
    await this.event(tx, updated, "subscription.renewed", renewalKey, now, {
      planCode: updated.planCode,
      interval: updated.interval,
      amount: target.price.toString(),
      termEnd: updated.termEnd.toISOString(),
    });
    return true;
  }

  private async enterGrace(
    tx: TransactionContext,
    row: UserSubscription,
    graceUntil: Date,
    now: Date,
    retryMs: number,
    amountDue: bigint,
  ): Promise<RenewalOutcome> {
    const updated = await tx.userSubscription.update({
      where: { id: row.id },
      data: {
        status: "GRACE",
        graceUntil,
        nextRenewalAttemptAt: minDate(
          new Date(now.getTime() + retryMs),
          graceUntil,
        ),
        version: { increment: 1 },
      },
    });
    await this.record(tx, "SUBSCRIPTION_GRACE", row, updated, null);
    await this.event(
      tx,
      updated,
      "subscription.grace-started",
      `grace:${row.id}:${row.termEnd.toISOString()}`,
      now,
      {
        planCode: updated.planCode,
        amountDue: amountDue.toString(),
        graceUntil: graceUntil.toISOString(),
      },
    );
    return "GRACE";
  }

  private async expire(
    tx: TransactionContext,
    row: UserSubscription,
    now: Date,
    reason: ExpiryReason,
  ): Promise<RenewalOutcome> {
    const endedAt = endTime(row, now, reason);
    const updated = await tx.userSubscription.update({
      where: { id: row.id },
      data: {
        status: "EXPIRED",
        endedAt,
        nextRenewalAttemptAt: null,
        version: { increment: 1 },
      },
    });
    await this.record(tx, "SUBSCRIPTION_EXPIRE", row, updated, null);
    await this.event(
      tx,
      updated,
      "subscription.expired",
      `expired:${row.id}`,
      now,
      { planCode: updated.planCode, reason, endedAt: endedAt.toISOString() },
    );
    return "EXPIRED";
  }

  private async reschedule(
    tx: TransactionContext,
    row: UserSubscription,
    at: Date,
  ): Promise<void> {
    await tx.userSubscription.update({
      where: { id: row.id },
      data: { nextRenewalAttemptAt: at },
    });
  }

  private async record(
    tx: TransactionContext,
    action: "SUBSCRIPTION_RENEW" | "SUBSCRIPTION_GRACE" | "SUBSCRIPTION_EXPIRE",
    before: UserSubscription,
    after: UserSubscription,
    charge: { amount: bigint; operationId: string } | null,
  ): Promise<void> {
    await this.audit.append(tx, {
      actor: SYSTEM_ACTOR,
      action,
      target: { type: "USER_SUBSCRIPTION", id: after.id },
      before: subscriptionAudit(before, null),
      after: subscriptionAudit(after, charge),
      reason: renewalReasons[action],
      context: auditContext(),
    });
  }

  /** Outbox event in the same transaction; the dedupe key makes a replayed step a no-op. */
  private async event(
    tx: TransactionContext,
    row: UserSubscription,
    type: string,
    dedupeKey: string,
    now: Date,
    details: Record<string, string>,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        aggregateType: "USER_SUBSCRIPTION",
        aggregateId: row.id,
        version: row.version,
        type,
        payload: {
          subscriptionId: row.id,
          userId: row.userId,
          ...details,
        } satisfies Prisma.InputJsonObject,
        dedupeKey: `${type}:${dedupeKey}`,
        correlationId: randomUUID(),
        availableAt: now,
      },
    });
  }
}

const renewalReasons = {
  SUBSCRIPTION_RENEW: "Subscription renewed at term end",
  SUBSCRIPTION_GRACE: "Renewal failed for lack of Credit; grace started",
  SUBSCRIPTION_EXPIRE: "Subscription ended",
} as const;

function minDate(left: Date, right: Date): Date {
  return left.getTime() <= right.getTime() ? left : right;
}

function endTime(row: UserSubscription, now: Date, reason: ExpiryReason): Date {
  if (reason === "AUTO_RENEW_OFF") return row.termEnd;
  // With 0 grace days the subscription ends at the term end itself.
  if (reason === "GRACE_ELAPSED") return row.graceUntil ?? row.termEnd;
  return now;
}
