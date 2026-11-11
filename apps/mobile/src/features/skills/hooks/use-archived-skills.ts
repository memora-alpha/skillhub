import { useInfiniteQuery } from "@tanstack/react-query";
import { useSkills } from "../context/SkillsProvider";
import { usePrivateSkillQuery } from "./use-private-skill-query";
import { useSkillReadFocus } from "./use-skill-read-focus";

export function useArchivedSkills() {
  const { api, scope, privateReads, assertCurrent } = useSkills();
  const key = [...scope, "own", true, "ARCHIVED"];
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      privateReads.read(key, async () => {
        const page = await api.archived(pageParam, signal);
        assertCurrent();
        return page;
      }),
    getNextPageParam: (last, _pages, _lastParam, parameters) => {
      const next = last.pagination.nextCursor;
      return last.pagination.hasMore && next && !parameters.includes(next)
        ? next
        : undefined;
    },
    retry: false,
  });
  useSkillReadFocus(query.refetch);
  return usePrivateSkillQuery(key, query);
}
