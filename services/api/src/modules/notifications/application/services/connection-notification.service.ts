import { preferredRecipients } from "../../domain/notification-preferences";
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
@Injectable()
export class ConnectionNotificationService {
  async createChat(
    tx: TransactionContext,
    input: {
      notificationId: string;
      userId: string;
      conversationId: string;
      messageId: string;
    },
  ) {
    if (
      !(await preferredRecipients(tx, [input.userId], "chat.message.delivered"))
        .length
    )
      return null;
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
  async create(
    tx: TransactionContext,
    input: { userId: string; type: string; proposalId: string },
  ) {
    // Database owner trigger appends notification.created in this same transaction.
    if (!(await preferredRecipients(tx, [input.userId], input.type)).length)
      return null;
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
