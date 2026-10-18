import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { z } from "zod";
import type { Actor } from "../../../shared/authorization/authorization.types";

export const TAG_PERMISSIONS = {
  USER: ["tag-request:create:self", "tag-request:read:self"],
  STAFF: [],
  ADMIN: [
    "tag:read",
    "tag:create",
    "tag:update",
    "tag-request:read",
    "tag-request:approve",
    "tag-request:reject",
  ],
} as const;

export function normalizeTagLabel(value: string): {
  label: string;
  labelKey: string;
} {
  if (typeof value !== "string" || /\p{Cc}/u.test(value)) {
    throw new BadRequestException("INVALID_TAG_LABEL");
  }
  const label = value.trim().normalize("NFC").replace(/\s+/gu, " ");
  if ([...label].length < 1 || [...label].length > 80) {
    throw new BadRequestException("INVALID_TAG_LABEL");
  }
  return { label, labelKey: label.toLowerCase() };
}

const label = z.string().transform((value) => normalizeTagLabel(value).label);
const reason = z
  .string()
  .trim()
  .refine((value) => [...value].length >= 1 && [...value].length <= 2000);
const expectedVersion = z.number().int().positive();
export const createTagSchema = z.strictObject({ label });
export const updateTagSchema = z
  .strictObject({
    label: label.optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    expectedVersion,
    reason,
  })
  .refine((value) => value.label !== undefined || value.status !== undefined);
export const approveTagRequestSchema = z.strictObject({ expectedVersion });
export const rejectTagRequestSchema = z.strictObject({
  expectedVersion,
  reason,
});
const pagination = {
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(1024).optional(),
};
export const adminTagQuerySchema = z.strictObject({
  ...pagination,
  q: z.string().trim().max(120).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
});
export const tagRequestQuerySchema = z.strictObject({
  ...pagination,
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

export function parseTagInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException("INVALID_TAG_INPUT");
  return result.data;
}

export function requireTagAdmin(actor: Actor): Actor {
  if (!actor.roles.includes("ADMIN"))
    throw new ForbiddenException("ADMIN_REQUIRED");
  return actor;
}
