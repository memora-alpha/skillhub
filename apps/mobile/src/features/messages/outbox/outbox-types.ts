import { z } from "zod";
import { uuid, timestamp } from "@/lib/http/contracts";
import { messageSchema } from "../api/messages-api";

export const queuedTextSchema = z.object({
  clientMessageId: uuid,
  conversationId: uuid,
  messageText: z
    .string()
    .min(1)
    .refine((value) => [...value].length <= 2000),
  createdAt: timestamp,
  state: z.enum(["queued", "sending", "processing", "failed", "sent"]),
  phase: z.enum(["send", "check"]),
  attempts: z.number().int().nonnegative(),
  retryAt: z.number().nonnegative(),
  rateLimitedUntil: z.number().nonnegative().optional(),
  messageId: uuid.optional(),
  message: messageSchema.optional(),
  failure: z.string().optional(),
});
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
