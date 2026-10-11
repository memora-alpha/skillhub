import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

const id = z.string().uuid();
const sequence = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine(
    (value) =>
      /^[1-9]\d*$/.test(value) &&
      value.length <= 19 &&
      BigInt(value) <= 9223372036854775807n,
  );
const proposal = z.object({ proposalId: id }).strict();
const message = z
  .object({ conversationId: id, messageId: id, messageSequence: sequence })
  .strict();
const notification = z.object({ notificationId: id }).strict();
const schemas: Record<string, z.ZodType> = {
  "proposal.created": proposal,
  "proposal.updated": proposal,
  "proposal.accepted": proposal,
  "proposal.rejected": proposal,
  "proposal.withdrawn": proposal,
  "proposal.expired": proposal,
  "chat.message.created": message,
  "chat.delivery.updated": message,
  "chat.read.updated": z
    .object({ conversationId: id, readerId: id, lastReadSequence: sequence })
    .strict(),
  "chat.attachment.updated": z.object({ fileId: id }).strict(),
  "notification.created": notification,
  "notification.read": notification,
};
export const PUBLIC_EVENTS = new Set(Object.keys(schemas));
export function validateEventPayload(type: string, payload: unknown) {
  if (!schemas[type]?.safeParse(payload).success)
    throw new BadRequestException("INVALID_PUBLIC_EVENT");
}
