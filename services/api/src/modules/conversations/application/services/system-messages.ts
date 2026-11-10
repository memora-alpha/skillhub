import { randomUUID } from "node:crypto";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { draftDigest } from "../../infrastructure/persistence/chat.repository";
import {
  systemMessageDraft,
  systemMessageSchema,
  type SystemMessageInput,
} from "../../domain/system-message";

/** Owner contract: stage both intent and immutable content in the caller's PG transaction.
 * No MongoDB or provider I/O occurs until the committed outbox event is delivered.
 */
export async function enqueueSystemMessage(
  tx: TransactionContext,
  input: SystemMessageInput,
) {
  const message = systemMessageSchema.parse(input);
  const messageId = randomUUID();
  const draft = systemMessageDraft(messageId, message);
  await tx.chatPublication.create({
    data: {
      id: messageId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      clientMessageId: messageId,
      commandDigest: draft.commandDigest,
      draftDigest: draftDigest(draft),
      deliveredEventId: randomUUID(),
      status: "COMMITTED",
    },
  });
  await tx.outboxEvent.create({
    data: {
      eventId: messageId,
      aggregateType: "CONVERSATION",
      aggregateId: message.conversationId,
      version: 1,
      type: "chat.system.publish",
      payload: { messageId, ...message },
      dedupeKey: `system-message:${messageId}`,
      correlationId: randomUUID(),
    },
  });
  return messageId;
}
