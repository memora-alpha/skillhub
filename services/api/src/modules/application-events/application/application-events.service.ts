import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import { TransactionRunner } from "../../../infrastructure/database/transaction-runner";
import { RedisService } from "../../../infrastructure/cache/redis.service";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
} from "../../../infrastructure/events/outbox.types";
import type { UserEventDelivery } from "../../../generated/prisma/client";
import type { Principal } from "../../auth/application/services/sessions.service";
import { SkillActorService } from "../../users/application/services/skill-actor.service";
import { EventConfig } from "../domain/event-config";
import { PUBLIC_EVENTS, validateEventPayload } from "../domain/event-payload";
export { PUBLIC_EVENTS } from "../domain/event-payload";

@Injectable()
export class ApplicationEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly listeners = new EventEmitter();
  private readonly subscriber;
  private trimTimer?: ReturnType<typeof setInterval>;
  constructor(
    private readonly db: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly redis: RedisService,
    private readonly registry: OutboxPublisherRegistry,
    private readonly actors: SkillActorService,
    private readonly config: EventConfig,
  ) {
    this.listeners.setMaxListeners(0);
    this.subscriber = redis.duplicate({
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    this.subscriber.on("error", () => undefined);
    this.subscriber.on("message", (_channel: string, userId: string) =>
      this.listeners.emit(userId),
    );
    this.subscriber.on("ready", () => {
      void this.subscriber
        .subscribe("skillhub:events:wakeup")
        .catch(() => undefined);
    });
  }
  onModuleInit() {
    this.registry.register("application.events.wakeup", {
      publish: async (event: OutboxMessage) => {
        const payload = event.payload;
        if (
          !payload ||
          typeof payload !== "object" ||
          Array.isArray(payload) ||
          typeof payload.userId !== "string"
        )
          throw new Error("INVALID_WAKEUP");
        // Wakeups are a latency hint. PostgreSQL is the replay authority; heartbeat catches loss.
        await this.redis
          .publish("skillhub:events:wakeup", payload.userId)
          .catch(() => undefined);
      },
    });
    void this.subscriber.connect().catch(() => undefined);
    this.trimTimer = setInterval(() => {
      void this.trimBacklogs().catch(() => undefined);
    }, 60000);
    this.trimTimer.unref();
  }
  onModuleDestroy() {
    if (this.trimTimer) clearInterval(this.trimTimer);
    this.subscriber.disconnect();
    this.listeners.removeAllListeners();
  }
  subscribe(userId: string, callback: () => void) {
    this.listeners.on(userId, callback);
    return () => this.listeners.off(userId, callback);
  }
  async authorize(principal: Principal) {
    await this.transactions.run((tx) =>
      this.actors.require(tx, principal, "event:read:self"),
    );
  }
  private async trimBacklogs() {
    const streams = await this.db.$queryRaw<
      { user_id: string }[]
    >`SELECT user_id FROM user_event_streams WHERE last_sequence-first_retained_sequence>=${this.config.values.rows} ORDER BY user_id LIMIT 100`;
    for (const stream of streams)
      await this.trim(stream.user_id, this.config.values.rows);
  }
  async append(
    tx: TransactionContext,
    users: readonly string[],
    source: string,
    type: string,
    payload: Record<string, string>,
  ) {
    validateEventPayload(type, payload);
    for (const userId of [...new Set(users)].sort((a, b) => a.localeCompare(b)))
      await tx.$executeRaw`SELECT skillhub_append_user_event(${userId}::uuid,${source}::uuid,${type},${JSON.stringify(payload)}::jsonb)`;
  }
  async head(userId: string) {
    return this.db.userEventStream.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }
  async lockRecipients(tx: TransactionContext, users: readonly string[]) {
    for (const userId of [...new Set(users)].sort((a, b) =>
      a.localeCompare(b),
    )) {
      await tx.$executeRaw`INSERT INTO user_event_streams(user_id) VALUES(${userId}::uuid) ON CONFLICT DO NOTHING`;
      await tx.$queryRaw`SELECT user_id FROM user_event_streams WHERE user_id=${userId}::uuid FOR UPDATE`;
    }
  }
  async batch(userId: string, epoch: string, after: bigint) {
    return this.transactions.run(async (tx) => {
      await tx.$queryRaw`SELECT user_id FROM user_event_streams WHERE user_id=${userId}::uuid FOR UPDATE`;
      const head = await tx.userEventStream.findUniqueOrThrow({
        where: { userId },
      });
      if (head.epoch !== epoch || after < head.firstRetainedSequence - 1n)
        throw new ConflictException("EVENT_CURSOR_EXPIRED");
      if (after > head.lastSequence)
        throw new BadRequestException("INVALID_EVENT_CURSOR");
      return tx.userEventDelivery.findMany({
        where: { userId, sequence: { gt: after } },
        orderBy: { sequence: "asc" },
        take: 100,
      });
    });
  }
  async visible(principal: Principal, event: UserEventDelivery) {
    return this.transactions.run(async (tx) => {
      const type = event.type,
        refs = event.payload as Record<string, string>;
      const permission = type.startsWith("proposal.")
        ? "proposal:read:party"
        : type.startsWith("notification.")
          ? "notification:read:self"
          : type === "chat.attachment.updated"
            ? "message:attachment:create:participant"
            : "conversation:read:participant";
      await this.actors.require(tx, principal, "event:read:self");
      try {
        await this.actors.require(tx, principal, permission);
      } catch {
        return false;
      }
      if (!PUBLIC_EVENTS.has(type)) return false;
      if (refs.proposalId)
        return !!(await tx.proposal.findFirst({
          where: {
            id: refs.proposalId,
            OR: [
              { proposerId: principal.userId },
              { recipientId: principal.userId },
            ],
          },
          select: { id: true },
        }));
      if (refs.conversationId)
        return !!(await tx.conversation.findFirst({
          where: {
            id: refs.conversationId,
            OR: [
              { participantAId: principal.userId },
              { participantBId: principal.userId },
            ],
          },
          select: { id: true },
        }));
      if (refs.notificationId)
        return !!(await tx.notification.findFirst({
          where: { id: refs.notificationId, userId: principal.userId },
          select: { id: true },
        }));
      if (refs.fileId)
        return !!(await tx.storedFile.findFirst({
          where: {
            id: refs.fileId,
            uploadedBy: principal.userId,
            purpose: "CHAT",
          },
          select: { id: true },
        }));
      return false;
    });
  }
  // Operational replay trimming only: business messages/receipts/files are never purged here.
  async trim(userId: string, maxRows = 10000) {
    await this.transactions.run(async (tx) => {
      await tx.$queryRaw`SELECT user_id FROM user_event_streams WHERE user_id=${userId}::uuid FOR UPDATE`;
      const head = await tx.userEventStream.findUnique({ where: { userId } });
      if (!head) return;
      const floor = head.lastSequence - BigInt(maxRows) + 1n;
      if (floor <= head.firstRetainedSequence) return;
      await tx.userEventDelivery.deleteMany({
        where: { userId, sequence: { lt: floor } },
      });
      await tx.userEventStream.update({
        where: { userId },
        data: { firstRetainedSequence: floor },
      });
    });
  }
  newSource() {
    return randomUUID();
  }
}
