import {
  queryOptions,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import type { createRequestsApi } from "../api/requests-api";
import type { Page, SkillOption } from "../types";

function cachedSkill(cache: QueryClient, key: QueryKey, id?: string) {
  if (!id) return undefined;
  for (const [queryKey, data] of cache.getQueriesData<
    InfiniteData<Page<SkillOption>>
  >({ queryKey: [...key, "skills"] })) {
    const state = cache.getQueryState(queryKey);
    if (state?.isInvalidated) continue;
    const skill = data?.pages
      .flatMap((page) => page.items)
      .find((item) => item.id === id);
    if (skill) return { skill, updatedAt: state?.dataUpdatedAt };
  }
  return undefined;
}

export function requestSkillOptions(
  api: ReturnType<typeof createRequestsApi>,
  key: QueryKey,
  id: string | undefined,
  cache: QueryClient,
) {
  const cached = cachedSkill(cache, key, id);
  return queryOptions({
    queryKey: [...key, "skill", id],
    queryFn: ({ signal }) => api.skill(id!, signal),
    staleTime: 5 * 60_000,
    initialData: cached?.skill,
    initialDataUpdatedAt: cached?.updatedAt,
    retry: false,
  });
}
