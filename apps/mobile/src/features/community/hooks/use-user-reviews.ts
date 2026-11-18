import { useMemo } from "react";
import { z } from "zod";
import { useConnections, useConnectionList } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import {
  createUserReviewsApi,
  userReviewSummary,
  type ReviewDirection,
} from "../api/user-reviews-api";

export function useUserReviews(
  userId: string,
  own = false,
  direction: ReviewDirection = "received",
) {
  const runtime = useConnections();
  const api = useMemo(() => createUserReviewsApi(runtime.call), [runtime]);
  const allowed = !own || runtime.userId === userId;
  const query = useConnectionList(
    ["profile-reviews", userId, own ? "own" : "public", direction],
    (cursor, signal) => api.list(userId, own, direction, cursor, signal),
    allowed && uuid.safeParse(userId).success,
    { refreshOnFocus: "stale", cancelOnDisable: true },
  );
  const parsed = z
    .object({ summary: userReviewSummary })
    .safeParse(query.data?.pages[0]);
  const readable = allowed && runtime.isCurrent();
  return {
    ...query,
    data: readable ? query.data : undefined,
    items: readable ? query.items : [],
    summary: readable && parsed.success ? parsed.data.summary : undefined,
    denied: query.denied || !allowed,
  };
}
