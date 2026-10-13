import { useQuery } from "@tanstack/react-query";
import { useSkills } from "../context/SkillsProvider";
import { findPublicSkill } from "../utils/find-public-skill";
import { useSkillReadFocus } from "./use-skill-read-focus";

export function usePublicSkill(userId: string | null, id: string | null) {
  const { api, scope, assertCurrent } = useSkills();
  const enabled = !!userId && !!id;
  const query = useQuery({
    queryKey: [...scope, "public-detail", userId, id],
    enabled,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const skill = await findPublicSkill(
        id!,
        (cursor, signal) => api.publicSkills(userId!, cursor, signal),
        signal,
      );
      assertCurrent();
      return skill;
    },
  });
  useSkillReadFocus(query.refetch, enabled);
  return query;
}
