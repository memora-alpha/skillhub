import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import {
  parse,
  parsePage,
  pageQuery,
  resourcePath,
  timestamp,
  uuid,
  version,
} from "@/lib/http/contracts";
import {
  materialImageUrl,
  materialRatingSummary,
} from "./material-media-contracts";

const rating = z.number().int().min(1).max(5);
const comment = z
  .string()
  .trim()
  .refine((value) => [...value].length <= 2000);
const fields = {
  id: uuid,
  rating,
  comment: z.string().nullable(),
  version,
  createdAt: timestamp,
  updatedAt: timestamp,
};
export const ownMaterialReview = z.object({
  ...fields,
  materialId: uuid,
  status: z.enum(["VISIBLE", "HIDDEN"]),
  deletedAt: timestamp.nullable(),
});
export const publicMaterialReview = z.object({
  ...fields,
  status: z.literal("VISIBLE"),
  reviewer: z.object({
    userId: uuid,
    fullName: z.string(),
    avatarUrl: materialImageUrl.nullable(),
  }),
  verifiedPurchase: z.boolean(),
});
export const materialReviewReasons = z.enum([
  "MATERIAL_NOT_PUBLISHED",
  "MATERIAL_OWNER_CANNOT_REVIEW",
  "MATERIAL_ACCESS_REQUIRED",
  "MATERIAL_PURCHASE_REQUIRED",
  "MATERIAL_ENTITLEMENT_REVOKED",
  "MATERIAL_REVIEW_ALREADY_EXISTS",
  "MATERIAL_REVIEW_HIDDEN",
]);
const eligibility = z
  .object({
    canReview: z.boolean(),
    reasonCode: materialReviewReasons.nullable(),
    canEdit: z.boolean().optional(),
    editReasonCode: materialReviewReasons
      .or(z.literal("MATERIAL_REVIEW_NOT_FOUND"))
      .nullable()
      .optional(),
    currentReview: ownMaterialReview.nullable(),
  })
  .refine((value) =>
    value.canReview
      ? value.reasonCode === null && value.currentReview === null
      : value.reasonCode !== null,
  )
  .refine((value) => {
    if (value.canEdit === undefined) return value.editReasonCode === undefined;
    return value.canEdit
      ? value.currentReview?.status === "VISIBLE" &&
          value.editReasonCode === null
      : typeof value.editReasonCode === "string";
  });
export const materialReviewInput = z.object({
  rating,
  comment: comment.optional(),
});
export type OwnMaterialReview = z.infer<typeof ownMaterialReview>;
export type MaterialReview = z.infer<typeof publicMaterialReview>;
export type MaterialReviewInput = z.infer<typeof materialReviewInput>;

export function createMaterialReviewsApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  const root = (id: string) => resourcePath("materials", id);
  function own(value: unknown, materialId: string, reviewId?: string) {
    const row = parse(ownMaterialReview, value);
    if (row.materialId !== materialId || (reviewId && row.id !== reviewId))
      throw new AppError("protocol");
    return row;
  }
  return {
    async reviews(materialId: string, cursor?: string, signal?: AbortSignal) {
      const result = await call(
        `${root(materialId)}/reviews?${pageQuery(cursor)}`,
        { includeMeta: true, signal },
      );
      const page = parsePage(publicMaterialReview, result);
      const summary = parse(
        z.object({ meta: z.object({ ratingSummary: materialRatingSummary }) }),
        result,
      ).meta.ratingSummary;
      if (new Set(page.items.map((row) => row.id)).size !== page.items.length)
        throw new AppError("protocol");
      return { ...page, summary };
    },
    async reviewEligibility(materialId: string, signal?: AbortSignal) {
      const value = parse(
        eligibility,
        await call(`${root(materialId)}/review-eligibility`, { signal }),
      );
      if (
        value.currentReview &&
        (value.currentReview.materialId !== materialId ||
          value.currentReview.deletedAt)
      )
        throw new AppError("protocol");
      return value;
    },
    async createReview(
      materialId: string,
      body: MaterialReviewInput,
      idempotencyKey: string,
    ) {
      const input = parse(materialReviewInput, body);
      if (!idempotencyKey.trim()) throw new AppError("protocol");
      return own(
        await call(`${root(materialId)}/reviews`, {
          method: "POST",
          body: input,
          idempotencyKey,
          replayAfterRenewal: false,
        }),
        materialId,
      );
    },
    async updateReview(
      materialId: string,
      reviewId: string,
      expectedVersion: number,
      body: MaterialReviewInput,
    ) {
      parse(uuid, materialId);
      const input = {
        ...parse(materialReviewInput, body),
        expectedVersion: parse(version, expectedVersion),
      };
      // An empty comment explicitly clears the saved comment; omitted means keep it.
      return own(
        await call(resourcePath("material-reviews", reviewId), {
          method: "PATCH",
          body: input,
          replayAfterRenewal: false,
        }),
        materialId,
        reviewId,
      );
    },
    async deleteReview(
      materialId: string,
      reviewId: string,
      expectedVersion: number,
    ) {
      parse(uuid, materialId);
      parse(version, expectedVersion);
      const result = parse(
        z.object({ review: ownMaterialReview, replayed: z.boolean() }),
        await call(
          `${resourcePath("material-reviews", reviewId)}?expectedVersion=${expectedVersion}`,
          { method: "DELETE", replayAfterRenewal: false },
        ),
      );
      const row = own(result.review, materialId, reviewId);
      if (!row.deletedAt) throw new AppError("protocol");
      return result;
    },
    async reportReview(reviewId: string, description: string) {
      const body = parse(
        z.object({
          reasonCode: z.literal("OTHER"),
          description: z.string().trim().min(10).max(2000),
        }),
        { reasonCode: "OTHER", description },
      );
      const result = parse(
        z.object({
          id: uuid,
          reviewId: uuid,
          status: z.literal("OPEN"),
          createdAt: timestamp,
        }),
        await call(`${resourcePath("material-reviews", reviewId)}/reports`, {
          method: "POST",
          body,
          replayAfterRenewal: false,
        }),
      );
      if (result.reviewId !== reviewId) throw new AppError("protocol");
      return result;
    },
  };
}
