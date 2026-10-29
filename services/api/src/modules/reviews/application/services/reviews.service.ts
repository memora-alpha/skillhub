import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import { lockLearningPath as lockPath } from "../../../learning-paths/application/services/learning-path-lock";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  ReputationService,
  reputationLevel,
} from "../../../reputation/application/services/reputation.service";
import { AchievementsService } from "../../../reputation/application/services/achievements.service";
import type { CreateReviewDto } from "../../presentation/http/reviews.dto";

const ratingDelta: Record<number, number> = { 1: -5, 2: -2, 3: 0, 4: 1, 5: 2 };

@Injectable()
export class ReviewsService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly reputation: ReputationService,
    private readonly achievements: AchievementsService,
  ) {}

  create(actor: Principal, pathId: string, input: CreateReviewDto) {
    return this.transactions.run(async (tx) => {
      await lockPath(tx, pathId);
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: pathId },
      });
      if (
        actor.userId !== path.participantAId &&
        actor.userId !== path.participantBId
      ) {
        throw new ForbiddenException("LEARNING_PATH_ACCESS_DENIED");
      }
      if (path.status !== "COMPLETED" || path.settledAt === null) {
        throw new ConflictException("REVIEW_NOT_OPEN");
      }
      const existing = await tx.review.findUnique({
        where: { pathId_reviewerId: { pathId, reviewerId: actor.userId } },
        select: { id: true },
      });
      if (existing) throw new ConflictException("REVIEW_ALREADY_SUBMITTED");
      const revieweeId =
        actor.userId === path.participantAId
          ? path.participantBId
          : path.participantAId;
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`
        SELECT CURRENT_TIMESTAMP AS now
      `;
      if (!(clock?.now instanceof Date)) {
        throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
      }
      const review = await tx.review.create({
        data: {
          id: randomUUID(),
          pathId,
          reviewerId: actor.userId,
          revieweeId,
          rating: input.rating,
          comment: input.comment?.trim() || null,
          createdAt: clock.now,
        },
      });
      await this.reputation.apply(tx, {
        userId: revieweeId,
        delta: ratingDelta[input.rating] ?? 0,
        reasonCode: "REVIEW_RATING",
        sourceType: "REVIEW",
        sourceId: review.id,
        eventKey: `review:${review.id}`,
        now: clock.now,
      });
      await this.achievements.evaluate(tx, revieweeId, clock.now);
      return review;
    });
  }

  listForPath(actor: Principal, pathId: string) {
    return this.transactions.run(async (tx) => {
      const path = await tx.learningPath.findUnique({ where: { id: pathId } });
      if (!path) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
      if (
        actor.userId !== path.participantAId &&
        actor.userId !== path.participantBId
      ) {
        throw new ForbiddenException("LEARNING_PATH_ACCESS_DENIED");
      }
      return tx.review.findMany({
        where: { pathId, hiddenAt: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
    });
  }

  history(actor: Principal, cursor?: string) {
    return this.transactions.run(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: actor.userId },
        select: { reputationScore: true },
      });
      if (!user) throw new NotFoundException("USER_NOT_FOUND");
      const rows = await tx.reputationHistory.findMany({
        where: { userId: actor.userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 51,
        ...(cursor
          ? {
              cursor: { id: cursor },
              skip: 1,
            }
          : {}),
      });
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (!(clock?.now instanceof Date)) {
        throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
      }
      const activeRestrictions = await tx.userRestriction.findMany({
        where: {
          userId: actor.userId,
          revokedAt: null,
          startsAt: { lte: clock.now },
          endsAt: { gt: clock.now },
        },
        orderBy: [{ endsAt: "asc" }, { id: "asc" }],
        select: { scope: true, reasonCode: true, endsAt: true },
      });
      return {
        reputationScore: user.reputationScore,
        level: reputationLevel(user.reputationScore),
        activeRestrictions,
        items: rows.slice(0, 50),
        nextCursor: rows.length > 50 ? (rows[49]?.id ?? null) : null,
      };
    });
  }
}
