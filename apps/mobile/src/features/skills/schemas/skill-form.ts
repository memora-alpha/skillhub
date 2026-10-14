import { z } from "zod";
import {
  skillLevels,
  type OwnSkill,
  type SkillInput,
  type SkillPatch,
} from "../types/skills";
export const normalizeText = (value: string) => value.trim().normalize("NFC");
export function normalizeYears(value: string): string | null {
  return value.trim().replace(",", ".") || null;
}
export const skillFormSchema = z.object({
  skillId: z.uuid("Chọn kỹ năng từ danh mục."),
  level: z.enum(skillLevels),
  description: z
    .string()
    .transform(normalizeText)
    .refine(
      (value) => [...value].length >= 20 && [...value].length <= 1500,
      "Mô tả cần từ 20 đến 1.500 ký tự.",
    ),
  experienceYears: z.string().refine((value) => {
    const years = normalizeYears(value);
    return years === null || /^(?:[0-5]?\d(?:\.\d)?|60(?:\.0)?)$/.test(years);
  }, "Nhập từ 0 đến 60 năm, tối đa một chữ số thập phân."),
  isVisible: z.boolean(),
});
export type SkillFormValues = z.input<typeof skillFormSchema>;
export function formValues(skill?: OwnSkill): SkillFormValues {
  return {
    skillId: skill?.skill.id ?? "",
    level: skill?.level ?? "BEGINNER",
    description: skill?.description ?? "",
    experienceYears: skill?.experienceYears ?? "",
    isVisible: skill?.isVisible ?? true,
  };
}
export function skillInput(values: SkillFormValues): SkillInput {
  const parsed = skillFormSchema.parse(values);
  return { ...parsed, experienceYears: normalizeYears(parsed.experienceYears) };
}
export function skillPatch(skill: OwnSkill, input: SkillInput): SkillPatch {
  const patch: SkillPatch = { expectedVersion: skill.version };
  if (input.level !== skill.level) patch.level = input.level;
  if (input.description !== skill.description)
    patch.description = input.description;
  if (
    Number(input.experienceYears) !== Number(skill.experienceYears) ||
    (input.experienceYears === null) !== (skill.experienceYears === null)
  )
    patch.experienceYears = input.experienceYears;
  if (input.isVisible !== skill.isVisible) patch.isVisible = input.isVisible;
  return patch;
}
