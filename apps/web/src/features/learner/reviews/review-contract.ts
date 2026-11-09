import { UserApiError } from "../api/client";

export type ReviewPerson = { userId: string; displayName: string } | null;
export type OwnReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: ReviewPerson;
  reviewee?: ReviewPerson;
};
export type ReviewSummary = {
  reviewCount: number;
  averageRating: number | null;
  ratingDistribution: Record<string, number>;
};
export type ReviewPage = { items: OwnReview[]; summary: ReviewSummary };
function person(value: unknown) {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return typeof p.userId === "string" && typeof p.displayName === "string";
}
export function readReviewPage(value: unknown): ReviewPage {
  const page = value as ReviewPage | null;
  const summary = page?.summary;
  if (
    !page ||
    !Array.isArray(page.items) ||
    !summary ||
    !Number.isSafeInteger(summary.reviewCount) ||
    summary.reviewCount < 0 ||
    (summary.reviewCount === 0
      ? summary.averageRating !== null
      : typeof summary.averageRating !== "number" ||
        !Number.isFinite(summary.averageRating) ||
        summary.averageRating < 1 ||
        summary.averageRating > 5) ||
    !summary.ratingDistribution ||
    [1, 2, 3, 4, 5].some(
      (n) =>
        !Number.isSafeInteger(summary.ratingDistribution[String(n)]) ||
        summary.ratingDistribution[String(n)]! < 0,
    ) ||
    [1, 2, 3, 4, 5].reduce(
      (sum, n) => sum + summary.ratingDistribution[String(n)]!,
      0,
    ) !== summary.reviewCount ||
    page.items.some(
      (row) =>
        !row ||
        typeof row.id !== "string" ||
        !row.id ||
        !Number.isInteger(row.rating) ||
        row.rating < 1 ||
        row.rating > 5 ||
        (row.comment !== null && typeof row.comment !== "string") ||
        typeof row.createdAt !== "string" ||
        !Number.isFinite(Date.parse(row.createdAt)) ||
        !person(row.reviewer) ||
        (row.reviewee !== undefined && !person(row.reviewee)),
    )
  )
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  return page;
}
