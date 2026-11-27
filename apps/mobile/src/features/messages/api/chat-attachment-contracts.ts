import { z } from "zod";
import { uuid } from "@/lib/http/contracts";

export const attachmentAvailabilitySchema = z.enum([
  "PENDING_SCAN",
  "AVAILABLE",
  "REVOKED",
  "UNAVAILABLE",
]);
export const chatModerationStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REVIEW_REQUIRED",
  "BLOCKED",
  "FAILED",
]);
export const chatAttachmentMetadata = {
  attachmentType: z.enum(["IMAGE", "DOCUMENT"]).optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  moderationStatus: chatModerationStatusSchema.optional(),
  accessStatus: attachmentAvailabilitySchema.optional(),
  availability: attachmentAvailabilitySchema.optional(),
  restrictionReason: z.enum(["BLOCKED", "REVOKED"]).optional(),
};
export const chatFileStatusSchema = z
  .object({
    ...chatAttachmentMetadata,
    fileId: uuid,
    state: z.string().min(1),
    generation: z.number().int(),
    canAttach: z.boolean().optional(),
    canRetry: z.boolean().optional(),
    mimeType: z.string().nullable().optional(),
    fileSizeBytes: z.number().int().nonnegative().nullable().optional(),
  })
  .transform((file) =>
    file.accessStatus ? { ...file, availability: file.accessStatus } : file,
  );
export type ChatFileStatus = z.infer<typeof chatFileStatusSchema>;

export const publishedAttachmentStatusSchema = z.object({
  moderationStatus: chatModerationStatusSchema,
  accessStatus: attachmentAvailabilitySchema,
  canRetry: z.boolean(),
});
