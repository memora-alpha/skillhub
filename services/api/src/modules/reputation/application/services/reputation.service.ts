import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { lockUsers } from "../../../../shared/database/identity-transactions";
import type { LearningPath } from "../../../../generated/prisma/client";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { AuditActor } from "../../../audit/application/contracts/audit.types";
import type { Principal } from "../../../auth/application/services/sessions.service";

const scoreMinimum = 0;
const scoreMaximum = 100;
const ruleVersion = "SRS-1.6";
const dayMilliseconds = 24 * 60 * 60 * 1000;
type RewardPath = Pick<
  LearningPath,
  "id" | "participantAId" | "participantBId"
>;
const policyActor = { kind: "SYSTEM", name: "reputation-policy" } as const;

/** Lock lengths an adjudicated decision may impose (SRS 1.6 §18.34 levels). */
export const ADJUDICATED_RESTRICTION_DAYS = [1, 3, 7, 30] as const;
export const RESTRICTION_REVIEW_DECISIONS = [
  "APPROVED",
  "FOLLOW_UP_REQUIRED",
] as const;
export type RestrictionReviewDecision =
  (typeof RESTRICTION_REVIEW_DECISIONS)[number];

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

  async reviewRestriction(
    tx: TransactionContext,
    actor: Principal,
    restrictionId: string,
    decision: RestrictionReviewDecision,
    reason: string,
  ) {
    const target = await tx.userRestriction.findUnique({
      where: { id: restrictionId },
    });
    if (!target) throw new NotFoundException("RESTRICTION_NOT_FOUND");
    const admin = actor.roles.includes("ADMIN");
    const staffReview =
      actor.roles.includes("STAFF") && target.scope === "REQUIRE_STAFF_REVIEW";
    if (
      !actor.permissions.includes("report:moderate") ||
      (!admin && !staffReview)
    )
      throw new ForbiddenException("RESTRICTION_REVIEW_FORBIDDEN");
    if (!reason.trim()) throw new ConflictException("RESOLUTION_NOTE_REQUIRED");
    await lockUsers(tx, [target.userId]);
    const current = await tx.userRestriction.findUniqueOrThrow({
      where: { id: restrictionId },
    });
    if (
      current.revokedAt ||
      !["REQUIRE_STAFF_REVIEW", "REQUIRE_ADMIN_REVIEW"].includes(current.scope)
    ) {
      throw new ConflictException("RESTRICTION_NOT_REVIEWABLE");
    }
    if (current.reviewDecision) {
      if (current.reviewDecision !== decision)
        throw new ConflictException("RESTRICTION_ALREADY_REVIEWED");
      return { restrictionId, decision, reviewedAt: current.reviewedAt };
    }
    const [clock] = await tx.$queryRaw<
      { now: Date }[]
    >`SELECT CURRENT_TIMESTAMP AS now`;
    if (!(clock?.now instanceof Date))
      throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
    await tx.userRestriction.update({
      where: { id: restrictionId },
      data: { reviewDecision: decision, reviewedAt: clock.now },
    });
    await this.audit.append(tx, {
      actor: {
        kind: "HUMAN",
        userId: actor.userId,
        roles: [admin ? "ADMIN" : "STAFF"],
      },
      action: "USER_RESTRICTION_REVIEW",
      target: { type: "USER", id: target.userId },
      after: { restrictionId, decision },
      reason: reason.trim(),
      context: auditContext(),
    });
    return { restrictionId, decision, reviewedAt: clock.now };
  }

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
      evaluateRestriction?: boolean;
      rewardPath?: RewardPath | null;
    },
  ): Promise<void> {
    const existing = await tx.reputationHistory.findUnique({
      where: { eventKey: input.eventKey },
      select: { id: true },
    });
    if (existing) return;
    if (input.rewardPath && input.delta > 0) {
      await lockUsers(tx, [
        input.rewardPath.participantAId,
        input.rewardPath.participantBId,
      ]);
    }
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT user_id AS id FROM users WHERE user_id = ${input.userId}::uuid FOR UPDATE
    `;
    if (rows.length === 0) throw new NotFoundException("USER_NOT_FOUND");
    const user = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { reputationScore: true },
    });
    const proposedScore = Math.max(
      scoreMinimum,
      Math.min(scoreMaximum, user.reputationScore + input.delta),
    );
    const scoreAfter =
      input.rewardPath &&
      proposedScore > user.reputationScore &&
      !(await this.reservePathReward(tx, input.rewardPath, input.now))
        ? user.reputationScore
        : proposedScore;
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
    if (input.evaluateRestriction && input.delta < 0)
      await this.applyRestriction(tx, input, scoreAfter);
  }

  async applyPathCompletion(
    tx: TransactionContext,
    userId: string,
    pathId: string,
    now: Date,
  ): Promise<void> {
    const rewardPath = await tx.learningPath.findUnique({
      where: { id: pathId },
    });
    if (rewardPath)
      await lockUsers(tx, [
        rewardPath.participantAId,
        rewardPath.participantBId,
      ]);
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
      rewardPath,
    });
  }

  private async reservePathReward(
    tx: TransactionContext,
    path: RewardPath,
    now: Date,
  ): Promise<boolean> {
    const { id, participantAId, participantBId } = path;
    const rewardedPaths = await tx.learningPath.findMany({
      where: {
        reputationRewardedAt: {
          gt: new Date(now.getTime() - 30 * dayMilliseconds),
        },
        OR: [
          { participantAId, participantBId },
          { participantAId: participantBId, participantBId: participantAId },
        ],
      },
      select: { id: true, reputationRewardedAt: true },
      take: 2,
    });
    const current = rewardedPaths.find((entry) => entry.id === id);
    if (!current && rewardedPaths.length >= 2) return false;
    if (!current?.reputationRewardedAt || current.reputationRewardedAt < now) {
      await tx.learningPath.update({
        where: { id },
        data: { reputationRewardedAt: now },
      });
    }
    return true;
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
      evaluateRestriction: true,
    });
  }

  /** Hook for session lifecycle once a no-show is final; one penalty per occurrence outcome. */
  applyNoShow(
    tx: TransactionContext,
    input: { userId: string; sessionId: string; outcomeId: string; now: Date },
  ): Promise<void> {
    return this.applyViolation(tx, {
      userId: input.userId,
      reasonCode: "NO_SHOW",
      sourceId: input.sessionId,
      eventKey: `no-show:${input.outcomeId}:${input.userId}`,
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
    if (days === 0) return;
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
