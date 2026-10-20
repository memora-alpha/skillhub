import { useQuery } from "@tanstack/react-query";
import { useSkills } from "../context/SkillsProvider";
import { findPublicSkill } from "../utils/find-public-skill";
import { useSkillReadFocus } from "./use-skill-read-focus";
import { usePrivateSkillQuery } from "./use-private-skill-query";

export function usePublicSkill(userId: string | null, id: string | null) {
  const { api, scope, assertCurrent, privateReads } = useSkills();
  const key = [...scope, "public-detail", userId, id];
  const enabled = !!userId && !!id;
  const query = useQuery({
    queryKey: key,
    enabled,
    staleTime: 0,
    queryFn: ({ signal }) =>
      privateReads.read(key, async () => {
        const skill = await findPublicSkill(
          id!,
          (cursor, signal) => api.publicSkills(userId!, cursor, signal),
          signal,
        );
        assertCurrent();
        return skill;
      }),
  });
  useSkillReadFocus(query.refetch, enabled);
  return usePrivateSkillQuery(key, query);
}
