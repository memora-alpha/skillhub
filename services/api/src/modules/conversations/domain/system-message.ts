import { z } from "zod";
import { fingerprintCommand } from "../../../infrastructure/idempotency/idempotency.service";

export const systemMessageSchema = z
  .object({
    conversationId: z.uuid(),
    senderId: z.uuid(),
    messageText: z.string().min(1).max(1000),
    objectType: z.enum(["SCHEDULE_PROPOSAL", "LEARNING_PATH"]),
    objectId: z.uuid(),
    objectVersion: z.number().int().positive(),
  })
  .strict();

export type SystemMessageInput = z.infer<typeof systemMessageSchema>;
export const systemMessageEventSchema = systemMessageSchema.extend({
  messageId: z.uuid(),
});

export function systemMessageDraft(
  messageId: string,
  input: SystemMessageInput,
) {
  return {
    ...input,
    _id: messageId,
    clientMessageId: messageId,
    messageType: "SYSTEM" as const,
    attachments: [],
    commandDigest: fingerprintCommand(input),
    draftFormatVersion: 1,
  };
}
