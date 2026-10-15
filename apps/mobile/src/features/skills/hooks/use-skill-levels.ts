import { useQuery } from "@tanstack/react-query";
import { useSkills } from "../context/SkillsProvider";
import { useSkillReadFocus } from "./use-skill-read-focus";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { SkillFormValues } from "../schemas/skill-form";
import type { OwnSkill } from "../types/skills";
import { canSaveLevel } from "../utils/skill-level";

export function useSkillLevels(skillId: string) {
  const { api, scope, assertCurrent } = useSkills();
  const query = useQuery({
    queryKey: [...scope, "levels", skillId],
    enabled: !!skillId,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const result = await api.levels(skillId, signal);
      assertCurrent();
      return result;
    },
  });
  useSkillReadFocus(query.refetch, !!skillId);
  return query;
}

export function useSkillLevelForm(
  form: UseFormReturn<SkillFormValues>,
  previous?: OwnSkill,
) {
  const skillId = form.watch("skillId");
  const levelId = form.watch("levelId");
  const levels = useSkillLevels(skillId);
  useEffect(() => {
    if (!previous || previous.levelId || levelId) return;
    const legacy = levels.data?.find((level) => level.code === previous.level);
    if (legacy) form.setValue("levelId", legacy.id, { shouldValidate: true });
  }, [previous, levelId, levels.data, form]);
  return { levels, levelValid: canSaveLevel(levelId, levels.data, previous) };
}
