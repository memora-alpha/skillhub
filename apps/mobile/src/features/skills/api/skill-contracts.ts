import { z } from "zod";
import { AppError } from "@/lib/http/errors";
import { skillBadges, batchStates } from "../types/skills";

const id = z.uuid();
const date = z.iso.datetime({ offset: true });
const nullableText = z.string().nullable();
const version = z.number().int().min(1);
export const catalogSchema = z.object({
  id,
  name: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
  description: nullableText,
});
export const skillLevelSchema = z.object({
  id,
  skillId: id,
  code: z.string().min(1),
  name: z.string().min(1),
  description: nullableText,
  sortOrder: z.number().int().min(0),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
export const publicSkillSchema = z
  .object({
    id,
    skill: catalogSchema,
    level: z.string().min(1),
    levelId: id.nullable().optional(),
    skillLevel: skillLevelSchema.nullable().optional(),
    description: z.string(),
    experienceYears: z
      .string()
      .regex(/^(?:[0-5]?\d(?:\.\d)?|60(?:\.0)?)$/)
      .nullable(),
    verificationStatus: z.enum(skillBadges),
  })
  .refine(
    (value) =>
      !value.skillLevel ||
      (value.skillLevel.id === value.levelId &&
        value.skillLevel.skillId === value.skill.id &&
        value.skillLevel.code === value.level),
  );
const summarySchema = z.object({
  id,
  status: z.enum(batchStates),
  submittedAt: date,
  rejectReason: nullableText,
});
export const ownSkillSchema = publicSkillSchema.safeExtend({
  isVisible: z.boolean(),
  archivedAt: date.nullable(),
  version,
  latestVerification: summarySchema.nullable(),
});
const evidenceSchema = z.object({
  id,
  title: nullableText,
  description: nullableText,
  mimeType: z.string(),
  fileSizeBytes: z.string().regex(/^\d+$/),
  approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED", "REVOKED"]),
  rejectReason: nullableText,
  revokedReason: nullableText,
  approvedAt: date.nullable(),
  revokedAt: date.nullable(),
});
export const verificationSchema = summarySchema.extend({
  sharingSkillId: id,
  version,
  reviewedAt: date.nullable(),
  note: nullableText,
  files: z.array(evidenceSchema),
});
export const fileStatusSchema = z.object({
  fileId: id,
  state: z.string().min(1),
});
export const downloadSchema = z.object({
  url: z.url().refine((value) => /^https?:\/\//.test(value)),
  expiresAt: date,
});

export function parseContract<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("protocol");
  return result.data;
}

export function parseOwnMutation(
  value: unknown,
  sharingId?: string,
  skillId?: string,
  levelId?: string,
) {
  const result = parseContract(ownSkillSchema, value);
  if (
    (sharingId && result.id !== sharingId) ||
    (skillId && result.skill.id !== skillId) ||
    (levelId && result.levelId !== levelId)
  )
    throw new AppError("protocol");
  return result;
}
