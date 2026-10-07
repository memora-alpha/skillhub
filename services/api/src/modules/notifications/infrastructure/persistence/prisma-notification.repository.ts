import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { LearningRequestRejectionPayload } from "../../../learning-requests/application/contracts/learning-request-rejection.event";
import type {
  NotificationCursor,
  NotificationRecord,
  NotificationRepository,
} from "../../application/ports/notification-repository";

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: Pick<PrismaService, "notification">,
  ) {}

  createLearningRequestRejected(
    tx: TransactionContext,
    notificationId: string,
    payload: LearningRequestRejectionPayload,
  ): Promise<NotificationRecord> {
    return tx.notification.create({
      data: {
        id: notificationId,
        userId: payload.ownerId,
        type: "LEARNING_REQUEST_REJECTED",
        title: "Learning request update",
        body: `Your learning request was rejected: ${payload.rejectReason}`,
        payload: {
          requestId: payload.requestId,
          reviewedVersion: payload.reviewedVersion,
          decisionVersion: payload.decisionVersion,
        },
        channel: "IN_APP",
      },
    });
  }

  listMine(
    tx: TransactionContext,
    userId: string,
    cursor: NotificationCursor | null,
    take: number,
  ): Promise<NotificationRecord[]> {
    return tx.notification.findMany({
      where: {
        userId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    });
  }

  async markRead(
    tx: TransactionContext,
    userId: string,
    notificationId: string,
  ): Promise<NotificationRecord | null> {
    const notification = await tx.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) return null;
    if (!notification.readAt) {
      const rows = await tx.$queryRaw<{ now: Date }[]>`
        SELECT CURRENT_TIMESTAMP AS now
      `;
      const readAt = rows[0]?.now;
      if (!(readAt instanceof Date) || !Number.isFinite(readAt.getTime())) {
        throw new TypeError("database time unavailable");
      }
      await tx.notification.updateMany({
        where: { id: notificationId, userId, readAt: null },
        data: { readAt },
      });
    }
    return tx.notification.findFirst({
      where: { id: notificationId, userId },
    });
  }
}
