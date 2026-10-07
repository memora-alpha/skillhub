import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
} from "@nestjs/common";
import { lockUsers } from "../../../../shared/database/identity-transactions";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  NOTIFICATION_REPOSITORY,
  type NotificationCursor,
  type NotificationRecord,
  type NotificationRepository,
} from "../ports/notification-repository";
import { NotificationAccessService } from "../services/notification-access.service";

export type NotificationItem = Pick<
  NotificationRecord,
  "id" | "type" | "title" | "body" | "payload" | "readAt" | "createdAt"
>;
export type NotificationPage = {
  items: NotificationItem[];
  nextCursor: string | null;
};

function decodeCursor(value: unknown): NotificationCursor | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 200) {
    throw new BadRequestException("INVALID_NOTIFICATION_CURSOR");
  }
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const separator = decoded.indexOf("|");
    const createdAt = new Date(decoded.slice(0, separator));
    const id = decoded.slice(separator + 1);
    if (
      separator < 1 ||
      !Number.isFinite(createdAt.getTime()) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      throw new Error("invalid cursor");
    }
    return { createdAt, id };
  } catch {
    throw new BadRequestException("INVALID_NOTIFICATION_CURSOR");
  }
}

function encodeCursor(notification: NotificationItem): string {
  return Buffer.from(
    `${notification.createdAt.toISOString()}|${notification.id}`,
  ).toString("base64url");
}

function toItem(record: NotificationRecord): NotificationItem {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    body: record.body,
    payload: record.payload,
    readAt: record.readAt,
    createdAt: record.createdAt,
  };
}

@Injectable()
export class ListNotificationsUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly access: NotificationAccessService,
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repository: NotificationRepository,
  ) {}

  async execute(
    actor: Principal,
    input: { limit?: number; cursor?: string },
  ): Promise<NotificationPage> {
    const limit = input.limit ?? 20;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException("INVALID_NOTIFICATION_PAGE");
    }
    const cursor = decodeCursor(input.cursor);
    return this.transactions.run(async (tx) => {
      await lockUsers(tx, [actor.userId]);
      const live = await this.access.assertAction(
        tx,
        actor,
        "notification:read:self",
      );
      const records = await this.repository.listMine(
        tx,
        live.userId,
        cursor,
        limit + 1,
      );
      const hasMore = records.length > limit;
      const items = records.slice(0, limit).map(toItem);
      return {
        items,
        nextCursor:
          hasMore && items.length > 0 ? encodeCursor(items.at(-1)!) : null,
      };
    });
  }
}

@Injectable()
export class MarkNotificationReadUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly access: NotificationAccessService,
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repository: NotificationRepository,
  ) {}

  async execute(
    actor: Principal,
    notificationId: string,
  ): Promise<NotificationItem> {
    return this.transactions.run(async (tx) => {
      await lockUsers(tx, [actor.userId]);
      const live = await this.access.assertAction(
        tx,
        actor,
        "notification:update:self",
      );
      const record = await this.repository.markRead(
        tx,
        live.userId,
        notificationId,
      );
      if (!record) throw new NotFoundException();
      return toItem(record);
    });
  }
}
