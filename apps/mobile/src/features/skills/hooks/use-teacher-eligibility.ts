import { useQuery } from "@tanstack/react-query";
import { readTeacherEligibility } from "../utils/read-teacher-eligibility";
import { useSkills } from "../context/SkillsProvider";
import { usePrivateSkillQuery } from "./use-private-skill-query";
import { useSkillReadFocus } from "./use-skill-read-focus";

export function useTeacherEligibility(
  skillId?: string,
  verifiedRequired = false,
) {
  const { api, scope, privateReads, assertCurrent } = useSkills();
  const key = [...scope, "proposal-eligibility", skillId, verifiedRequired];
  const query = useQuery({
    queryKey: key,
    enabled: !!skillId,
    retry: false,
    queryFn: ({ signal }) =>
      privateReads.read(key, () =>
        readTeacherEligibility(
          (cursor, requestSignal) => api.own(false, cursor, requestSignal),
          skillId!,
          verifiedRequired,
          signal,
          assertCurrent,
        ),
      ),
  });
  useSkillReadFocus(query.refetch, !!skillId);
  return usePrivateSkillQuery(key, query);
}
