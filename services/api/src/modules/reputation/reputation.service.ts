import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { TransactionContext } from "../../infrastructure/database/transaction-context";
import { AuditWriter } from "../audit/application/audit-writer";
import type { AuditActor } from "../audit/application/audit.types";

const scoreMinimum = 0;
const scoreMaximum = 100;
const ruleVersion = "SRS-1.6";
const dayMilliseconds = 24 * 60 * 60 * 1000;
const policyActor = { kind: "SYSTEM", name: "reputation-policy" } as const;

/** Lock lengths an adjudicated decision may impose (SRS 1.6 §18.34 levels). */
export const ADJUDICATED_RESTRICTION_DAYS = [1, 3, 7, 30] as const;

/** SRS 1.6 §18.34 reputation bands; WARNING is shown to the owner without a lock. */
export function reputationLevel(score: number) {
  if (score >= 80) return "EXCELLENT";
  if (score >= 50) return "NORMAL";
  if (score >= 40) return "WARNING";
  if (score >= 30) return "RESTRICTED";
  if (score >= 20) return "LOW";
  if (score >= 10) return "SEVERE";
  return "CRITICAL";
}

/** 7-day locks add Staff review and 30-day locks Admin review. */
function restrictionScopes(days: number): string[] {
  if (days >= 30) return ["CREATE_NEW_ACTIVITY", "REQUIRE_ADMIN_REVIEW"];
  if (days >= 7) return ["CREATE_NEW_ACTIVITY", "REQUIRE_STAFF_REVIEW"];
  return ["CREATE_NEW_ACTIVITY"];
}

function restrictionSnapshot(restriction: { scope: string; endsAt: Date }) {
  return { scope: restriction.scope, endsAt: restriction.endsAt.toISOString() };
}

function auditContext() {
  return { requestId: randomUUID(), correlationId: randomUUID() };
}

function restrictionDays(score: number): number {
  if (score >= 40) return 0;
  if (score >= 30) return 1;
  if (score >= 20) return 3;
  if (score >= 10) return 7;
  return 30;
}

@Injectable()
export class ReputationService {
  constructor(private readonly audit: AuditWriter) {}

  async assertMayCreateActivity(
    tx: TransactionContext,
    userId: string,
    now: Date,
  ): Promise<void> {
    const restriction = await tx.userRestriction.findFirst({
      where: {
        userId,
        scope: "CREATE_NEW_ACTIVITY",
        startsAt: { lte: now },
        endsAt: { gt: now },
        revokedAt: null,
      },
      select: { id: true },
    });
    if (restriction) throw new ForbiddenException("NEW_ACTIVITY_RESTRICTED");
  }

  async apply(
    tx: TransactionContext,
    input: {
      userId: string;
      delta: number;
      reasonCode: string;
      sourceType: string;
      sourceId: string;
      eventKey: string;
      now: Date;
    },
  ): Promise<void> {
    const existing = await tx.reputationHistory.findUnique({
      where: { eventKey: input.eventKey },
      select: { id: true },
    });
    if (existing) return;
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT user_id AS id FROM users WHERE user_id = ${input.userId}::uuid FOR UPDATE
    `;
    if (rows.length === 0) throw new NotFoundException("USER_NOT_FOUND");
    const user = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { reputationScore: true },
    });
    const scoreAfter = Math.max(
      scoreMinimum,
      Math.min(scoreMaximum, user.reputationScore + input.delta),
    );
    const actualDelta = scoreAfter - user.reputationScore;
    await tx.user.update({
      where: { id: input.userId },
      data: { reputationScore: scoreAfter },
    });
    await tx.reputationHistory.create({
      data: {
        userId: input.userId,
        scoreBefore: user.reputationScore,
        scoreAfter,
        delta: actualDelta,
        reasonCode: input.reasonCode,
        ruleVersion,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        eventKey: input.eventKey,
        createdAt: input.now,
      },
    });
    await this.applyRestriction(tx, input, scoreAfter);
  }

  async applyPathCompletion(
    tx: TransactionContext,
    userId: string,
    pathId: string,
    now: Date,
  ): Promise<void> {
    const locks = await tx.$queryRaw<{ id: string }[]>`
      SELECT user_id AS id FROM users WHERE user_id = ${userId}::uuid FOR UPDATE
    `;
    if (locks.length === 0) throw new NotFoundException("USER_NOT_FOUND");
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthlyCompletions = await tx.reputationHistory.count({
      where: {
        userId,
        reasonCode: "PATH_COMPLETED",
        createdAt: { gte: monthStart },
      },
    });
    await this.apply(tx, {
      userId,
      delta: monthlyCompletions < 10 ? 1 : 0,
      reasonCode: "PATH_COMPLETED",
      sourceType: "LEARNING_PATH",
      sourceId: pathId,
      eventKey: `path-completion:${pathId}:${userId}`,
      now,
    });
  }

  async applyViolation(
    tx: TransactionContext,
    input: {
      userId: string;
      reasonCode:
        | "LATE_CANCELLATION"
        | "NO_SHOW"
        | "LIGHT_VIOLATION"
        | "MEDIUM_HARASSMENT"
        | "FRAUD";
      delta?: number;
      sourceId: string;
      eventKey: string;
      now: Date;
    },
  ): Promise<void> {
    const fixedDeltas = {
      LATE_CANCELLATION: -3,
      NO_SHOW: -8,
      LIGHT_VIOLATION: -5,
      MEDIUM_HARASSMENT: -10,
    } as const;
    const delta =
      input.reasonCode === "FRAUD"
        ? input.delta
        : fixedDeltas[input.reasonCode];
    if (
      !Number.isInteger(delta) ||
      (input.reasonCode === "FRAUD" && (delta! < -30 || delta! > -20)) ||
      (input.reasonCode !== "FRAUD" &&
        input.delta !== undefined &&
        input.delta !== delta)
    ) {
      throw new TypeError("invalid reputation violation delta");
    }
    await this.apply(tx, {
      userId: input.userId,
      delta: delta!,
      reasonCode: input.reasonCode,
      sourceType: "ADJUDICATED_VIOLATION",
      sourceId: input.sourceId,
      eventKey: input.eventKey,
      now: input.now,
    });
  }

  /** Hook for session lifecycle (SH-070/072) once a no-show is confirmed. */
  applyNoShow(
    tx: TransactionContext,
    input: { userId: string; sessionId: string; now: Date },
  ): Promise<void> {
    return this.applyViolation(tx, {
      userId: input.userId,
      reasonCode: "NO_SHOW",
      sourceId: input.sessionId,
      eventKey: `no-show:${input.sessionId}:${input.userId}`,
      now: input.now,
    });
  }

  /** A higher lock imposed by an adjudicated case, independent of the score. */
  async applyAdjudicatedRestriction(
    tx: TransactionContext,
    input: {
      userId: string;
      days: (typeof ADJUDICATED_RESTRICTION_DAYS)[number];
      caseId: string;
      actor: AuditActor;
      reason: string;
      now: Date;
    },
  ): Promise<void> {
    const { superseded, applied } = await this.restrict(tx, {
      userId: input.userId,
      days: input.days,
      reasonCode: "ADJUDICATED_VIOLATION",
      sourceType: "REPORT_CASE",
      sourceId: input.caseId,
      now: input.now,
    });
    if (applied.length === 0) return;
    await this.audit.append(tx, {
      actor: input.actor,
      action: "USER_RESTRICTION_APPLY",
      target: { type: "USER", id: input.userId },
      before: { restrictions: superseded.map(restrictionSnapshot) },
      after: { restrictions: applied.map(restrictionSnapshot) },
      reason: input.reason,
      context: auditContext(),
    });
  }

  private async applyRestriction(
    tx: TransactionContext,
    input: { userId: string; sourceType: string; sourceId: string; now: Date },
    score: number,
  ) {
    const days = restrictionDays(score);
    if (days === 0) {
      const lifted = await tx.userRestriction.findMany({
        where: {
          userId: input.userId,
          reasonCode: "LOW_REPUTATION",
          revokedAt: null,
        },
        select: { id: true, scope: true, endsAt: true },
      });
      if (lifted.length === 0) return;
      await tx.userRestriction.updateMany({
        where: { id: { in: lifted.map(({ id }) => id) } },
        data: { revokedAt: input.now },
      });
      await this.audit.append(tx, {
        actor: policyActor,
        action: "USER_RESTRICTION_REVOKE",
        target: { type: "USER", id: input.userId },
        before: { restrictions: lifted.map(restrictionSnapshot) },
        after: { score, restrictions: [] },
        reason: `Reputation score ${score} lifts low-reputation restrictions`,
        context: auditContext(),
      });
      return;
    }
    const { superseded, applied } = await this.restrict(tx, {
      ...input,
      days,
      reasonCode: "LOW_REPUTATION",
    });
    if (applied.length === 0) return;
    await this.audit.append(tx, {
      actor: policyActor,
      action: "USER_RESTRICTION_APPLY",
      target: { type: "USER", id: input.userId },
      before: { restrictions: superseded.map(restrictionSnapshot) },
      after: { score, restrictions: applied.map(restrictionSnapshot) },
      reason: `Reputation score ${score} requires a ${days}-day restriction`,
      context: auditContext(),
    });
  }

  /**
   * Extends each scope's lock of the same reason to `days` from now. A longer
   * active lock of that reason is kept; locks of other reasons live on their own.
   */
  private async restrict(
    tx: TransactionContext,
    input: {
      userId: string;
      days: number;
      reasonCode: string;
      sourceType: string;
      sourceId: string;
      now: Date;
    },
  ) {
    const endsAt = new Date(input.now.getTime() + input.days * dayMilliseconds);
    const superseded: { scope: string; endsAt: Date }[] = [];
    const applied: { scope: string; endsAt: Date }[] = [];
    for (const scope of restrictionScopes(input.days)) {
      const active = await tx.userRestriction.findMany({
        where: {
          userId: input.userId,
          scope,
          reasonCode: input.reasonCode,
          revokedAt: null,
          endsAt: { gt: input.now },
        },
        orderBy: { endsAt: "desc" },
      });
      if (active[0] && active[0].endsAt >= endsAt) continue;
      if (active.length > 0) {
        await tx.userRestriction.updateMany({
          where: { id: { in: active.map(({ id }) => id) } },
          data: { revokedAt: input.now },
        });
        superseded.push(...active);
      }
      await tx.userRestriction.create({
        data: {
          userId: input.userId,
          scope,
          reasonCode: input.reasonCode,
          startsAt: input.now,
          endsAt,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      });
      applied.push({ scope, endsAt });
    }
    return { superseded, applied };
  }
}
