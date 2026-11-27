import { z } from "zod";
import { uuid, timestamp } from "@/lib/http/contracts";
import { messageSchema } from "../api/messages-api";

export const queuedTextSchema = z
  .object({
    clientMessageId: uuid,
    conversationId: uuid,
    messageText: z.string().refine((value) => [...value].length <= 2000),
    attachment: z
      .object({
        name: z.string().min(1).max(255),
        uri: z.string().min(1),
        mimeType: z.string().min(1),
        size: z.number().int().positive().max(15_000_000),
        fileId: uuid.optional(),
      })
      .optional(),
    createdAt: timestamp,
    state: z.enum(["queued", "sending", "processing", "failed", "sent"]),
    phase: z.enum(["prepare", "send", "check"]),
    attempts: z.number().int().nonnegative(),
    retryAt: z.number().nonnegative(),
    rateLimitedUntil: z.number().nonnegative().optional(),
    messageId: uuid.optional(),
    message: messageSchema.optional(),
    failure: z.string().optional(),
    failureCode: z.string().optional(),
  })
  .refine((entry) => !!entry.messageText.trim() || !!entry.attachment)
  .refine((entry) => entry.phase !== "prepare" || !!entry.attachment)
  .refine(
    (entry) =>
      !entry.attachment || entry.phase !== "check" || !!entry.attachment.fileId,
  );
export type QueuedText = z.infer<typeof queuedTextSchema>;
export type OutboxStorage = {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
};
export type OutboxSnapshot = {
  ready: boolean;
  items: QueuedText[];
  error?: unknown;
};
export const savedOutboxSchema = z.object({
  version: z.literal(1),
  ownerId: uuid,
  scope: z.string(),
  items: z.array(queuedTextSchema),
});
