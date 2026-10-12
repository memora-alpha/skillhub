import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { TransactionContext } from "../../infrastructure/database/transaction-context";

const scoreMinimum = 0;
const scoreMaximum = 100;
const ruleVersion = "SRS-1.6";

function restrictionDays(score: number): number {
  if (score >= 40) return 0;
  if (score >= 30) return 1;
  if (score >= 20) return 3;
  if (score >= 10) return 7;
  return 30;
}

@Injectable()
export class ReputationService {
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

  private async applyRestriction(
    tx: TransactionContext,
    input: { userId: string; sourceType: string; sourceId: string; now: Date },
    score: number,
  ) {
    const days = restrictionDays(score);
    if (days === 0) {
      await tx.userRestriction.updateMany({
        where: {
          userId: input.userId,
          reasonCode: "LOW_REPUTATION",
          revokedAt: null,
        },
        data: { revokedAt: input.now },
      });
      return;
    }
    const endsAt = new Date(input.now.getTime() + days * 24 * 60 * 60 * 1000);
    const scopes = [
      "CREATE_NEW_ACTIVITY",
      ...(score < 20
        ? [score < 10 ? "REQUIRE_ADMIN_REVIEW" : "REQUIRE_STAFF_REVIEW"]
        : []),
    ];
    for (const scope of scopes) {
      const active = await tx.userRestriction.findMany({
        where: {
          userId: input.userId,
          scope,
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
      }
      await tx.userRestriction.create({
        data: {
          userId: input.userId,
          scope,
          reasonCode: "LOW_REPUTATION",
          startsAt: input.now,
          endsAt,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      });
    }
  }
}
