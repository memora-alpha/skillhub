import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConnections } from "@/features/connections";
import { useCommunityApi, usePathReviews } from "./use-community";
import { createReviewSubmission } from "../utils/review-submission";
import type { ReviewInput } from "../api/community-api";

export function useReviewSubmission(pathId: string, counterpartId: string) {
  const runtime = useConnections();
  const cache = useQueryClient();
  const api = useCommunityApi();
  const reviews = usePathReviews(pathId, counterpartId);
  const submission = useMemo(
    () => createReviewSubmission(),
    [runtime, pathId, counterpartId],
  );
  const [, update] = useState(0);
  const [error, setError] = useState<unknown>();
  const own = reviews.data?.find((row) => row.reviewerId === runtime.userId);
  const send = async (input: ReviewInput) => {
    if (
      own ||
      reviews.error ||
      !reviews.data ||
      reviews.isFetching ||
      reviews.denied
    )
      return;
    setError(undefined);
    const operation = submission.send(
      () => api.submit(pathId, counterpartId, input),
      runtime.isCurrent,
    );
    update((v) => v + 1);
    try {
      const saved = await operation;
      if (!saved || !runtime.isCurrent()) return;
      await cache.cancelQueries({
        queryKey: [...runtime.key, "reviews", pathId],
      });
      if (!runtime.isCurrent()) return;
      cache.setQueryData(
        [...runtime.key, "reviews", pathId, counterpartId],
        [
          ...(reviews.data ?? []).filter(
            (row) => row.reviewerId !== saved.reviewerId,
          ),
          saved,
        ],
      );
    } catch (failure) {
      if (runtime.isCurrent()) setError(failure);
    } finally {
      if (runtime.isCurrent()) update((v) => v + 1);
    }
  };
  const refresh = async () => {
    const result = await reviews.refetch();
    if (!runtime.isCurrent() || !result.isSuccess || !result.data) return;
    submission.observed(
      result.data.some((row) => row.reviewerId === runtime.userId),
    );
    setError(undefined);
    update((v) => v + 1);
  };
  return { reviews, own, send, refresh, error, state: submission.state };
}
