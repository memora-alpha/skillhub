import type { QueryClient, QueryKey } from "@tanstack/react-query";

export async function refreshLearningPath(
  cache: QueryClient,
  scope: QueryKey,
  pathId: string,
  isCurrent: () => boolean,
) {
  if (!isCurrent()) return;
  await Promise.allSettled([
    cache.invalidateQueries({
      queryKey: [...scope, "learning-paths", pathId],
      exact: true,
    }),
    cache.invalidateQueries({
      queryKey: [...scope, "learning-paths", "mine"],
      exact: true,
    }),
  ]);
}
