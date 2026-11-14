import { BadRequestException } from "@nestjs/common";

export type MaterialReviewStatus = "VISIBLE" | "HIDDEN";
export type MaterialReviewEligibilityReason =
  | "MATERIAL_NOT_PUBLISHED"
  | "MATERIAL_OWNER_CANNOT_REVIEW"
  | "MATERIAL_ACCESS_REQUIRED"
  | "MATERIAL_PURCHASE_REQUIRED"
  | "MATERIAL_ENTITLEMENT_REVOKED"
  | "MATERIAL_REVIEW_ALREADY_EXISTS"
  | "MATERIAL_REVIEW_HIDDEN";

export function reviewRating(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 5)
    throw new BadRequestException("MATERIAL_REVIEW_RATING_INVALID");
  return value;
}

export function reviewComment(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if ([...normalized].length > 2_000)
    throw new BadRequestException("MATERIAL_REVIEW_COMMENT_INVALID");
  return normalized;
}

export type RatingSummaryRow = {
  visibleCount: number;
  star1: number;
  star2: number;
  star3: number;
  star4: number;
  star5: number;
  ratingSum: number;
};

export function ratingSummaryView(summary?: RatingSummaryRow | null) {
  const row = summary ?? {
    visibleCount: 0,
    star1: 0,
    star2: 0,
    star3: 0,
    star4: 0,
    star5: 0,
    ratingSum: 0,
  };
  return {
    average:
      row.visibleCount === 0
        ? null
        : (row.ratingSum / row.visibleCount).toFixed(2),
    total: row.visibleCount,
    stars: {
      1: row.star1,
      2: row.star2,
      3: row.star3,
      4: row.star4,
      5: row.star5,
    },
  };
}
