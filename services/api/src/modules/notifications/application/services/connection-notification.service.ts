import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
@Injectable()
export class ConnectionNotificationService {
  createChat(
    tx: TransactionContext,
    input: {
      notificationId: string;
      userId: string;
      conversationId: string;
      messageId: string;
    },
  ) {
    return tx.notification.create({
      data: {
        id: input.notificationId,
        userId: input.userId,
        type: "chat.message.delivered",
        title: "New message",
        body: "A participant sent a message.",
        payload: {
          conversationId: input.conversationId,
          messageId: input.messageId,
        },
        channel: "IN_APP",
      },
    });
  }
  create(
    tx: TransactionContext,
    input: { userId: string; type: string; proposalId: string },
  ) {
    // Database owner trigger appends notification.created in this same transaction.
    return tx.notification.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        type: input.type,
        title: "Connection update",
        body: "A connection proposal has an update.",
        payload: { proposalId: input.proposalId },
        channel: "IN_APP",
      },
    });
  }
}
