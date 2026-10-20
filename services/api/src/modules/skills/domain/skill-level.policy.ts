import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import type { SharingSkillLevel } from "../../../generated/prisma/client";

export const DEFAULT_SKILL_LEVELS = [
  { code: "BEGINNER", name: "Beginner" },
  { code: "INTERMEDIATE", name: "Intermediate" },
  { code: "ADVANCED", name: "Advanced" },
  { code: "EXPERT", name: "Expert" },
] as const;

const normalizedText = z
  .string()
  .transform((value) => value.trim().normalize("NFC"));
export const skillLevelFields = {
  name: normalizedText.pipe(z.string().min(2).max(100)),
  description: normalizedText.pipe(z.string().max(500)).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100000),
  status: z.enum(["ACTIVE", "INACTIVE"]),
};
export const createSkillLevelSchema = z.strictObject({
  ...skillLevelFields,
  code: z.string().regex(/^[A-Z0-9][A-Z0-9_-]{0,39}$/u),
  reason: normalizedText.pipe(z.string().min(1).max(2000)),
});
export const updateSkillLevelSchema = z
  .strictObject({
    ...z.strictObject(skillLevelFields).partial().shape,
    expectedVersion: z.number().int().positive(),
    reason: normalizedText.pipe(z.string().min(1).max(2000)),
  })
  .refine((value) =>
    Object.keys(value).some(
      (key) => key !== "reason" && key !== "expectedVersion",
    ),
  );

export type CreateSkillLevel = z.input<typeof createSkillLevelSchema>;
export type UpdateSkillLevel = z.input<typeof updateSkillLevelSchema>;

export function parseSkillLevel<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new BadRequestException("INVALID_SKILL_LEVEL");
  return parsed.data;
}

export function legacySkillLevel(code: string): SharingSkillLevel | null {
  return DEFAULT_SKILL_LEVELS.find((item) => item.code === code)?.code ?? null;
}
