import {
  levelLabels,
  type LegacySkillLevel,
  type PublicSkill,
  type SkillLevel,
} from "../types/skills";

export function skillLevelLabel(
  skill: Pick<PublicSkill, "level" | "skillLevel">,
) {
  return (
    skill.skillLevel?.name ??
    (Object.hasOwn(levelLabels, skill.level)
      ? levelLabels[skill.level as LegacySkillLevel]
      : skill.level)
  );
}

export function canSaveLevel(
  levelId: string,
  levels?: SkillLevel[],
  previous?: PublicSkill,
) {
  // Content/visibility edits may preserve a historical inactive level. Only a
  // new selection is required to be in the current ACTIVE catalog.
  return (
    !!levelId &&
    (levelId === previous?.levelId ||
      !!levels?.some(
        (level) =>
          level.id === levelId &&
          level.status === "ACTIVE" &&
          (!previous || level.skillId === previous.skill.id),
      ))
  );
}
