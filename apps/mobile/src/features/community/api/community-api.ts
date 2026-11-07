import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import { parse, resourcePath, timestamp, uuid } from "@/lib/http/contracts";

const score = z.number().int().min(0).max(100);
export const reviewInput = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});
const reviewSchema = z.object({
  id: uuid,
  pathId: uuid,
  reviewerId: uuid,
  revieweeId: uuid,
  rating: reviewInput.shape.rating,
  comment: z.string().nullable(),
  createdAt: timestamp,
  hiddenAt: timestamp.nullable(),
});
const historyItem = z
  .object({
    id: uuid,
    userId: uuid,
    scoreBefore: score,
    scoreAfter: score,
    delta: z.number().int().min(-100).max(100),
    reasonCode: z.string(),
    sourceType: z.string(),
    sourceId: uuid,
    createdAt: timestamp,
  })
  .refine((row) => row.scoreAfter - row.scoreBefore === row.delta);
const reputationSchema = z.object({
  reputationScore: score,
  level: z.string().min(1),
  activeRestrictions: z.array(
    z.object({
      scope: z.string().min(1),
      reasonCode: z.string(),
      endsAt: timestamp,
    }),
  ),
  policyNotice: z.array(z.string()).nullable().optional(),
  restrictionReviews: z
    .array(
      z.object({
        id: uuid,
        scope: z.enum(["REQUIRE_STAFF_REVIEW", "REQUIRE_ADMIN_REVIEW"]),
        endsAt: timestamp,
        decision: z.enum(["APPROVED", "FOLLOW_UP_REQUIRED"]).nullable(),
        reviewedAt: timestamp.nullable(),
      }),
    )
    .optional(),
  items: z.array(historyItem).max(50),
  nextCursor: uuid.nullable(),
});
const missionCode = z.enum([
  "POLICY_AWARENESS",
  "GOOD_BEHAVIOR_STREAK",
  "COMMITMENT_RECOVERY",
]);
const recoverySchema = z.object({
  eligible: z.boolean(),
  remainingBudget: z.number().int().min(0).max(5),
  missions: z
    .array(
      z.object({
        code: missionCode,
        reward: z.number().int().min(1).max(3),
        claimed: z.boolean(),
        progress: z.object({
          current: z.number().int().nonnegative(),
          target: z.number().int().positive(),
          complete: z.boolean(),
        }),
      }),
    )
    .max(3),
  quiz: z
    .object({
      version: z.string(),
      policy: z.array(z.string()),
      questions: z.array(z.string()).length(5),
    })
    .nullable(),
});
const recoveryResult = z.object({
  passed: z.boolean(),
  awarded: z.number().int().min(0).max(3),
});
export type RecoveryMissionCode = z.infer<typeof missionCode>;
export type Review = z.infer<typeof reviewSchema>;
export type ReviewInput = z.infer<typeof reviewInput>;
export type Reputation = z.infer<typeof reputationSchema>;

export function createCommunityApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
  userId: string,
) {
  const root = (id: string) => `${resourcePath("learning-paths", id)}/reviews`;
  function checkedReview(row: Review, pathId: string, counterpartId: string) {
    parse(uuid, userId);
    parse(uuid, counterpartId);
    if (
      userId === counterpartId ||
      row.pathId !== pathId ||
      ![userId, counterpartId].includes(row.reviewerId) ||
      row.revieweeId !== (row.reviewerId === userId ? counterpartId : userId)
    )
      throw new AppError("protocol");
    return row;
  }
  return {
    async acknowledgeReputationPolicy() {
      return parse(
        z.object({ acknowledged: z.literal(true) }),
        await call("/reputation/restrictions/policy-acknowledgement", {
          method: "POST",
          replayAfterRenewal: false,
        }),
      );
    },
    async recovery(signal?: AbortSignal) {
      return parse(
        recoverySchema,
        await call("/reputation/recovery", { signal }),
      );
    },
    async submitRecoveryQuiz(version: string, answers: boolean[]) {
      return parse(
        recoveryResult,
        await call("/reputation/recovery/quiz", {
          method: "POST",
          body: { version, answers },
          replayAfterRenewal: false,
        }),
      );
    },
    async claimRecovery(
      code: Exclude<RecoveryMissionCode, "POLICY_AWARENESS">,
    ) {
      return parse(
        recoveryResult,
        await call("/reputation/recovery/claim", {
          method: "POST",
          body: { code },
          replayAfterRenewal: false,
        }),
      );
    },
    async reviews(pathId: string, counterpartId: string, signal?: AbortSignal) {
      const rows = parse(
        z.array(reviewSchema).max(2),
        await call(root(pathId), { signal }),
      );
      rows.forEach((row) => checkedReview(row, pathId, counterpartId));
      if (
        new Set(rows.map((row) => row.reviewerId)).size !== rows.length ||
        rows.some((row) => row.hiddenAt !== null)
      )
        throw new AppError("protocol");
      return rows;
    },
    async submit(pathId: string, counterpartId: string, input: ReviewInput) {
      const body = parse(reviewInput, input);
      const row = checkedReview(
        parse(
          reviewSchema,
          await call(root(pathId), {
            method: "POST",
            body,
            replayAfterRenewal: false,
          }),
        ),
        pathId,
        counterpartId,
      );
      if (row.reviewerId !== userId || row.hiddenAt !== null)
        throw new AppError("protocol");
      return row;
    },
    async reputation(cursor?: string, signal?: AbortSignal) {
      const query = new URLSearchParams();
      if (cursor) query.set("cursor", parse(uuid, cursor));
      const result = parse(
        reputationSchema,
        await call(`/reputation/me${cursor ? `?${query}` : ""}`, { signal }),
      );
      if (
        result.items.some((row) => row.userId !== userId) ||
        new Set(result.items.map((row) => row.id)).size !==
          result.items.length ||
        result.nextCursor === cursor ||
        (result.nextCursor !== null &&
          result.items.at(-1)?.id !== result.nextCursor)
      )
        throw new AppError("protocol");
      return result;
    },
  };
}
