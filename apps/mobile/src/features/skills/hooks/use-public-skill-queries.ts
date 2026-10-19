import { useInfiniteQuery } from "@tanstack/react-query";
import { useSkills } from "../context/SkillsProvider";
import { useSkillReadFocus } from "./use-skill-read-focus";
import { usePrivateSkillQuery } from "./use-private-skill-query";

export function usePublicSkills(targetUserId?: string) {
  const {
    api,
    scope,
    userId: ownUserId,
    assertCurrent,
    deletedSkillIds,
    privateReads,
  } = useSkills();
  const userId = targetUserId ?? ownUserId;
  const key = [...scope, "public", userId];
  const query = useInfiniteQuery({
    queryKey: key,
    staleTime: 0,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      privateReads.read(key, async () => {
        const result = await api.publicSkills(userId, pageParam, signal);
        assertCurrent();
        return {
          ...result,
          data: result.data.filter(
            (skill) => userId !== ownUserId || !deletedSkillIds.has(skill.id),
          ),
        };
      }),
    getNextPageParam: (last) =>
      last.pagination.hasMore
        ? (last.pagination.nextCursor ?? undefined)
        : undefined,
  });
  useSkillReadFocus(query.refetch);
  return usePrivateSkillQuery(key, query);
}
export function useCatalog(search: string, enabled = true) {
  const { api, scope, assertCurrent } = useSkills();
  const q = search.trim().normalize("NFC");
  const length = [...q].length;
  return useInfiniteQuery({
    queryKey: [...scope, "catalog", q],
    enabled: enabled && (!length || (length >= 2 && length <= 100)),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const result = await api.catalog(q || undefined, pageParam, signal);
      assertCurrent();
      return result;
    },
    getNextPageParam: (last) =>
      last.pagination.hasMore
        ? (last.pagination.nextCursor ?? undefined)
        : undefined,
  });
}
