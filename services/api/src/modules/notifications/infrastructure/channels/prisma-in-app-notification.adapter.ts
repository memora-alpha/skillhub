import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type {
  InAppNotificationPort,
  NotificationMessage,
} from "../../application/ports/notification-channels";

/** Writes to the existing notifications inbox until SH-110 replaces it. */
@Injectable()
export class PrismaInAppNotificationAdapter implements InAppNotificationPort {
  async notify(
    tx: TransactionContext,
    message: NotificationMessage,
  ): Promise<void> {
    await tx.notification.createMany({
      data: message.userIds.map((userId, index) => ({
        id: index === 0 ? message.eventId : randomUUID(),
        userId,
        type: message.type,
        title: message.title,
        body: message.body,
        payload: message.payload,
        channel: "IN_APP" as const,
      })),
    });
  }
}
