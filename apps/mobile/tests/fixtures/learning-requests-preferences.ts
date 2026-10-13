import { z } from "zod";
import {
  availabilitySchema,
  creditSchema,
  idsSchema,
  normalizeCredit,
} from "../../src/features/learning-requests/schemas/request-preferences";
import { fixtureId, fixtureSkills } from "./learning-requests-data";

export const fixtureTags = Array.from({ length: 25 }, (_, index) => ({
  id: fixtureId(20 + index),
  label:
    index === 0
      ? "Thực hành"
      : index === 1
        ? "Dự án"
        : `Tag ${String(index).padStart(2, "0")}`,
}));
export const fixtureOfferings = [0, 1].map((index) => ({
  id: fixtureId(50 + index),
  skill: fixtureSkills[index]!,
  level: "INTERMEDIATE" as const,
  verificationStatus: index ? "VERIFIED" : "UNVERIFIED",
  isVisible: true,
  archivedAt: null,
}));
const schema = z
  .object({
    teachingOverview: z.string().nullable().optional(),
    tagIds: idsSchema.optional(),
    offeredSharingSkillIds: idsSchema.optional(),
    preferredAvailability: availabilitySchema.nullable().optional(),
    desiredCreditPerHour: creditSchema.nullable().optional(),
  })
  .refine(
    (input) =>
      input.tagIds?.every((id) => fixtureTags.some((tag) => tag.id === id)) ??
      true,
  )
  .refine(
    (input) =>
      input.offeredSharingSkillIds?.every((id) =>
        fixtureOfferings.some((skill) => skill.id === id),
      ) ?? true,
  );
export function fixturePreferences(body: Record<string, unknown>) {
  const result = schema.safeParse(body);
  if (
    !result.success ||
    (result.data.preferredAvailability?.weeklySlots.length &&
      Array.isArray(body.preferredSlots) &&
      body.preferredSlots.length)
  )
    return undefined;
  return {
    ...result.data,
    ...(result.data.desiredCreditPerHour
      ? {
          desiredCreditPerHour: normalizeCredit(
            result.data.desiredCreditPerHour,
          ),
        }
      : {}),
  };
}
export function selectedOfferings(ids: string[]) {
  return fixtureOfferings
    .filter((skill) => ids.includes(skill.id))
    .map(({ id, skill, level, verificationStatus }) => ({
      id,
      skill: { id: skill.id, name: skill.name },
      level,
      verificationStatus,
    }));
}
