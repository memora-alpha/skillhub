import type { z } from "zod";
import { ConflictException } from "@nestjs/common";
import type {
  Tag,
  TagCreationRequest,
} from "../../../../generated/prisma/client";
import type {
  createTagSchema,
  updateTagSchema,
  approveTagRequestSchema,
  rejectTagRequestSchema,
  adminTagQuerySchema,
  tagRequestQuerySchema,
} from "../../domain/tag-policy";

export type CreateTagInput = z.input<typeof createTagSchema>;
export type UpdateTagInput = z.input<typeof updateTagSchema>;
export type ApproveTagRequestInput = z.input<typeof approveTagRequestSchema>;
export type RejectTagRequestInput = z.input<typeof rejectTagRequestSchema>;
export type AdminTagQuery = z.output<typeof adminTagQuerySchema>;
export type TagRequestQuery = z.output<typeof tagRequestQuerySchema>;

export function tagUniqueConflict(error: unknown, code: string): never {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  )
    throw new ConflictException(code);
  throw error;
}

export function tagSnapshot(row: Tag) {
  return {
    label: row.label,
    status: row.status,
    version: row.version,
    createdByUserId: row.createdByUserId,
  };
}
export function tagRequestSnapshot(row: TagCreationRequest) {
  return {
    label: row.label,
    status: row.status,
    version: row.version,
    requestedByUserId: row.requestedByUserId,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    resultTagId: row.resultTagId,
    rejectReason: row.rejectReason,
  };
}
