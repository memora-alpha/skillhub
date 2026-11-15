import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { ratingSummaryView } from "../../domain/material-review.policy";

export async function recomputeMaterialRatingSummary(
  tx: TransactionContext,
  materialId: string,
) {
  const groups = await tx.materialReview.groupBy({
    by: ["rating"],
    where: { materialId, status: "VISIBLE", deletedAt: null },
    _count: { _all: true },
  });
  const stars = [0, 0, 0, 0, 0];
  for (const group of groups) {
    if (group.rating >= 1 && group.rating <= 5)
      stars[group.rating - 1] = group._count._all;
  }
  const visibleCount = stars.reduce((total, count) => total + count, 0);
  const ratingSum = stars.reduce(
    (total, count, index) => total + count * (index + 1),
    0,
  );
  return tx.materialRatingSummary.upsert({
    where: { materialId },
    create: {
      materialId,
      visibleCount,
      star1: stars[0]!,
      star2: stars[1]!,
      star3: stars[2]!,
      star4: stars[3]!,
      star5: stars[4]!,
      ratingSum,
    },
    update: {
      visibleCount,
      star1: stars[0]!,
      star2: stars[1]!,
      star3: stars[2]!,
      star4: stars[3]!,
      star5: stars[4]!,
      ratingSum,
    },
  });
}

export const materialRatingSummaryView = ratingSummaryView;
