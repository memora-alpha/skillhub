import { z } from "zod";
import { parse, uuid, timestamp, pageQuery } from "@/lib/http/contracts";
import type { RequestOptions } from "@/lib/http/client";

export type ReviewDirection = "received" | "sent";
const person = z.object({ userId: uuid, displayName: z.string() }).nullable();
export const userReviewSummary = z.object({
  reviewCount: z.number().int().nonnegative(),
  averageRating: z.number().min(1).max(5).nullable(),
  ratingDistribution: z.record(z.string(), z.number().int().nonnegative()),
});
const page = z.object({
  data: z.object({
    items: z.array(
      z.object({
        id: uuid,
        rating: z.number().int().min(1).max(5),
        comment: z.string().nullable(),
        createdAt: timestamp,
        reviewer: person,
        reviewee: person.optional(),
      }),
    ),
    summary: userReviewSummary,
  }),
  meta: z.object({
    pagination: z.object({ nextCursor: z.string().nullable() }),
  }),
});

export function createUserReviewsApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  return {
    async list(
      userId: string,
      own: boolean,
      direction: ReviewDirection,
      cursor?: string,
      signal?: AbortSignal,
    ) {
      parse(uuid, userId);
      const query = pageQuery(cursor);
      if (own) query.set("direction", direction);
      const endpoint = own
        ? "/me/reviews"
        : `/profiles/${encodeURIComponent(userId)}/reviews`;
      const result = parse(
        page,
        await call(`${endpoint}?${query}`, { signal, includeMeta: true }),
      );
      return { ...result.data, nextCursor: result.meta.pagination.nextCursor };
    },
  };
}
