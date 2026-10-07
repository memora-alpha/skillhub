import type { Prisma } from "../../../../generated/prisma/client";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { LearningRequestRejectionPayload } from "../../../learning-requests/application/contracts/learning-request-rejection.event";

export const NOTIFICATION_REPOSITORY = Symbol("NOTIFICATION_REPOSITORY");

export type NotificationRecord = Prisma.NotificationGetPayload<object>;
export type NotificationCursor = { createdAt: Date; id: string };

export interface NotificationRepository {
  createLearningRequestRejected(
    tx: TransactionContext,
    notificationId: string,
    payload: LearningRequestRejectionPayload,
  ): Promise<NotificationRecord>;
  listMine(
    tx: TransactionContext,
    userId: string,
    cursor: NotificationCursor | null,
    take: number,
  ): Promise<NotificationRecord[]>;
  markRead(
    tx: TransactionContext,
    userId: string,
    notificationId: string,
  ): Promise<NotificationRecord | null>;
}
