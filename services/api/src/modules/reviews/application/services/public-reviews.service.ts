import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { z } from "zod";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { UsersService } from "../../../users/application/services/users.service";
import {
  PublicReviewReader,
  type ReviewSummary,
} from "../../../users/application/services/public-review-reader";

const cursorSchema = z.strictObject({
  userId: z.uuid(),
  direction: z.enum(["received", "sent"]),
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});
export function reviewBoundary(
  cursor: string | undefined,
  userId: string,
  direction: string,
) {
  if (!cursor) return null;
  try {
    if (cursor.length > 1024) throw new Error("oversize");
    const value = cursorSchema.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
    if (value.userId !== userId || value.direction !== direction)
      throw new Error("scope");
    return { createdAt: new Date(value.createdAt), id: value.id };
  } catch {
    throw new BadRequestException("INVALID_REVIEW_CURSOR");
  }
}
export function summarizeReviews(
  groups: { rating: number; _count: { _all: number } }[],
): ReviewSummary {
  const ratingDistribution: Record<string, number> = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  };
  let count = 0,
    total = 0;
  for (const row of groups) {
    ratingDistribution[String(row.rating)] = row._count._all;
    count += row._count._all;
    total += row.rating * row._count._all;
  }
  return {
    reviewCount: count,
    averageRating: count ? Math.round((total / count) * 100) / 100 : null,
    ratingDistribution,
  };
}
@Injectable()
export class PublicReviewsService implements OnModuleInit {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly users: UsersService,
    private readonly profileReviews: PublicReviewReader,
  ) {}
  onModuleInit() {
    this.profileReviews.register((id) => this.summary(id));
  }
  private async active(tx: TransactionContext, userId: string) {
    const user = await this.users.byId(tx, userId);
    if (!user || user.accountStatus !== "ACTIVE")
      throw new NotFoundException("PROFILE_NOT_FOUND");
  }
  private async aggregate(tx: TransactionContext, userId: string) {
    const groups = await tx.review.groupBy({
      by: ["rating"],
      where: { revieweeId: userId, hiddenAt: null },
      _count: { _all: true },
    });
    return summarizeReviews(groups);
  }
  summary(userId: string) {
    return this.transactions.run(async (tx) => {
      await this.active(tx, userId);
      return this.aggregate(tx, userId);
    });
  }
  page(
    userId: string,
    query: { limit?: number; cursor?: string },
    direction: "received" | "sent" = "received",
  ) {
    const limit = query.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException("INVALID_REVIEW_LIMIT");
    const boundary = reviewBoundary(query.cursor, userId, direction);
    return this.transactions.run(async (tx) => {
      await this.active(tx, userId);
      const rows = await tx.review.findMany({
        where: {
          ...(direction === "received"
            ? { revieweeId: userId }
            : { reviewerId: userId }),
          hiddenAt: null,
          ...(boundary
            ? {
                OR: [
                  { createdAt: { lt: boundary.createdAt } },
                  { createdAt: boundary.createdAt, id: { lt: boundary.id } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          reviewerIdRecord: {
            select: { id: true, fullName: true, accountStatus: true },
          },
          revieweeIdRecord: {
            select: { id: true, fullName: true, accountStatus: true },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });
      const visible = rows.slice(0, limit),
        last = visible.at(-1);
      const publicPerson = (person: {
        id: string;
        fullName: string;
        accountStatus: string;
      }) =>
        person.accountStatus === "ACTIVE"
          ? { userId: person.id, displayName: person.fullName }
          : null;
      return {
        data: visible.map((row) => ({
          id: row.id,
          rating: row.rating,
          comment: row.comment,
          createdAt: row.createdAt,
          reviewer: publicPerson(row.reviewerIdRecord),
          ...(direction === "sent"
            ? { reviewee: publicPerson(row.revieweeIdRecord) }
            : {}),
        })),
        summary: await this.aggregate(tx, userId),
        pagination: {
          limit,
          hasMore: rows.length > limit,
          nextCursor:
            rows.length > limit && last
              ? Buffer.from(
                  JSON.stringify({
                    userId,
                    direction,
                    createdAt: last.createdAt.toISOString(),
                    id: last.id,
                  }),
                ).toString("base64url")
              : null,
        },
      };
    });
  }
}
