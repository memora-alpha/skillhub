import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { LearningPath, Review } from "../../../../generated/prisma/client";
import { lockLearningPath as lockPath } from "../../../learning-paths/application/services/learning-path-lock";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  ReputationService,
  reputationLevel,
} from "../../../reputation/application/services/reputation.service";
import { AchievementsService } from "../../../reputation/application/services/achievements.service";
import type { CreateReviewDto } from "../../presentation/http/reviews.dto";
import {
  ContentModerationService,
  requireAllowed,
} from "../../../content-moderation/application/content-moderation.service";
import {
  effectiveRestriction,
  recoveryPolicy,
} from "../../../reputation/domain/restriction-policy";

const ratingDelta: Record<number, number> = { 1: -5, 2: -2, 3: 0, 4: 1, 5: 2 };

@Injectable()
export class ReviewsService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly reputation: ReputationService,
    private readonly achievements: AchievementsService,
    private readonly moderation?: ContentModerationService,
  ) {}

  async create(actor: Principal, pathId: string, input: CreateReviewDto) {
    const comment = input.comment?.trim() || null;
    let pending = false;
    if (
      comment &&
      this.moderation &&
      this.moderation.mode("review") !== "off"
    ) {
      await this.transactions.run((tx) =>
        this.reviewCandidate(tx, actor, pathId),
      );
      const assessment = await this.moderation.evaluateText(
        "review",
        "submission",
        [comment],
      );
      pending = assessment.outcome === "REVIEW";
      if (!pending) requireAllowed(assessment);
    }
    return this.transactions.run(async (tx) => {
      await lockPath(tx, pathId);
      const { path, existing } = await this.reviewCandidate(tx, actor, pathId);
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
      const content = {
        rating: input.rating,
        comment,
        createdAt: clock.now,
        hiddenAt: pending ? clock.now : null,
        publicationState: pending ? "PENDING" : null,
      };
      const review = existing
        ? await tx.review.update({
            where: { id: existing.id },
            data: { ...content, moderationVersion: { increment: 1 } },
          })
        : await tx.review.create({
            data: {
              id: randomUUID(),
              pathId,
              reviewerId: actor.userId,
              revieweeId,
              ...content,
            },
          });
      if (!pending) await this.applyReviewEffects(tx, path, review, clock.now);
      return review;
    });
  }

  private async reviewCandidate(
    tx: TransactionContext,
    actor: Principal,
    pathId: string,
  ) {
    const path = await tx.learningPath.findUniqueOrThrow({
      where: { id: pathId },
    });
    if (
      actor.userId !== path.participantAId &&
      actor.userId !== path.participantBId
    )
      throw new ForbiddenException("LEARNING_PATH_ACCESS_DENIED");
    if (path.status !== "COMPLETED" || path.settledAt === null)
      throw new ConflictException("REVIEW_NOT_OPEN");
    const existing = await tx.review.findUnique({
      where: { pathId_reviewerId: { pathId, reviewerId: actor.userId } },
      select: { id: true, publicationState: true },
    });
    if (existing && existing.publicationState !== "REJECTED")
      throw new ConflictException("REVIEW_ALREADY_SUBMITTED");
    return { path, existing };
  }

  async applyReviewEffects(
    tx: TransactionContext,
    path: LearningPath,
    review: Review,
    now: Date,
  ) {
    await this.reputation.apply(tx, {
      userId: review.revieweeId,
      delta: ratingDelta[review.rating] ?? 0,
      reasonCode: "REVIEW_RATING",
      sourceType: "REVIEW",
      sourceId: review.id,
      eventKey: `review:${review.id}`,
      now,
      rewardPath: path,
    });
    await this.achievements.evaluate(tx, review.revieweeId, now);
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
        where: {
          pathId,
          OR: [
            { hiddenAt: null },
            {
              reviewerId: actor.userId,
              publicationState: { in: ["PENDING", "REJECTED"] },
            },
          ],
        },
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
          ...effectiveRestriction(clock.now),
        },
        orderBy: [{ endsAt: "asc" }, { id: "asc" }],
        select: {
          scope: true,
          reasonCode: true,
          endsAt: true,
          policyRequired: true,
          policyAcknowledgedAt: true,
        },
      });
      const restrictionReviews = await tx.userRestriction.findMany({
        where: {
          userId: actor.userId,
          revokedAt: null,
          startsAt: { lte: clock.now },
          scope: { in: ["REQUIRE_STAFF_REVIEW", "REQUIRE_ADMIN_REVIEW"] },
        },
        orderBy: [{ startsAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          scope: true,
          endsAt: true,
          reviewDecision: true,
          reviewedAt: true,
        },
        take: 50,
      });
      return {
        reputationScore: user.reputationScore,
        level: reputationLevel(user.reputationScore),
        activeRestrictions: activeRestrictions.map(
          ({ scope, reasonCode, endsAt }) => ({
            scope,
            reasonCode,
            endsAt,
          }),
        ),
        policyNotice: activeRestrictions.some(
          (row) => row.policyRequired && !row.policyAcknowledgedAt,
        )
          ? recoveryPolicy
          : null,
        restrictionReviews: restrictionReviews.map(
          ({ reviewDecision, reviewedAt, ...row }) => ({
            ...row,
            decision: reviewDecision ?? null,
            reviewedAt: reviewedAt ?? null,
          }),
        ),
        items: rows.slice(0, 50),
        nextCursor: rows.length > 50 ? (rows[49]?.id ?? null) : null,
      };
    });
  }
}
