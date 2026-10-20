import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
} from "../../../../infrastructure/events/outbox.types";
import { lockUsers } from "../../../../shared/database/identity-transactions";
import { ApplicationEventsService } from "../../../application-events/application/services/application-events.service";
import {
  ChatRepository,
  type ChatMessage,
} from "../../infrastructure/persistence/chat.repository";
import { ConnectionNotificationService } from "../../../notifications/application/services/connection-notification.service";
@Injectable()
export class ChatPublicationService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  constructor(
    private readonly db: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly chat: ChatRepository,
    private readonly events: ApplicationEventsService,
    private readonly registry: OutboxPublisherRegistry,
    private readonly notifications: ConnectionNotificationService,
  ) {}
  onModuleInit() {
    this.registry.register("chat.message.publish", {
      publish: (event) => this.publish(event),
    });
    this.timer = setInterval(() => {
      void this.bridge().catch(() => undefined);
    }, 5000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async publish(event: OutboxMessage) {
    const payload = event.payload;
    if (
      event.version !== 1 ||
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      typeof payload.messageId !== "string"
    )
      throw new Error("INVALID_CHAT_PUBLICATION");
    await this.deliver(payload.messageId);
  }
  async deliver(id: string): Promise<ChatMessage> {
    const receipt = await this.db.chatPublication.findUniqueOrThrow({
      where: { id },
    });
    if (
      !["COMMITTED", "DELIVERED"].includes(receipt.status) ||
      !receipt.draftDigest
    )
      throw new Error("MESSAGE_NOT_COMMITTED");
    let published;
    try {
      published = await this.chat.publish(id, receipt.draftDigest);
    } catch (error) {
      await this.db.chatPublication.updateMany({
        where: { id, status: "COMMITTED" },
        data: { failureCode: "CHAT_PUBLICATION_RETRY_REQUIRED" },
      });
      throw error;
    }
    if (!published?.sequence) throw new Error("MESSAGE_NOT_PUBLISHED");
    await this.transactions.run(async (tx) => {
      const conversation = await tx.conversation.findUniqueOrThrow({
        where: { id: receipt.conversationId },
      });
      await lockUsers(tx, [
        conversation.participantAId,
        conversation.participantBId,
      ]);
      await tx.$queryRaw`SELECT conversation_id FROM conversations WHERE conversation_id=${conversation.id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM chat_publications WHERE id=${id}::uuid FOR UPDATE`;
      const won = await tx.chatPublication.updateMany({
        where: { id, status: "COMMITTED", draftDigest: receipt.draftDigest },
        data: {
          status: "DELIVERED",
          messageSequence: BigInt(published.sequence!.toString()),
          failureCode: null,
        },
      });
      if (!won.count) return;
      await this.events.lockRecipients(tx, [
        conversation.participantAId,
        conversation.participantBId,
      ]);
      await this.notifications.createChat(tx, {
        notificationId: receipt.deliveredEventId,
        userId:
          receipt.senderId === conversation.participantAId
            ? conversation.participantBId
            : conversation.participantAId,
        conversationId: conversation.id,
        messageId: id,
      });
      const refs = {
        conversationId: conversation.id,
        messageId: id,
        messageSequence: published.sequence!.toString(),
      };
      await this.events.append(
        tx,
        [conversation.participantAId, conversation.participantBId],
        receipt.deliveredEventId,
        "chat.message.created",
        refs,
      );
      await this.events.append(
        tx,
        [receipt.senderId],
        receipt.deliveredEventId,
        "chat.delivery.updated",
        refs,
      );
    });
    return published;
  }
  async bridge() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const intent of await this.chat.pendingIntents()) {
        await this.transactions.run(async (tx) => {
          const conversation = await tx.conversation.findUniqueOrThrow({
            where: { id: intent.conversationId },
          });
          await lockUsers(tx, [
            conversation.participantAId,
            conversation.participantBId,
          ]);
          await tx.$queryRaw`SELECT conversation_id FROM conversations WHERE conversation_id=${conversation.id}::uuid FOR UPDATE`;
          await this.events.append(
            tx,
            [conversation.participantAId, conversation.participantBId],
            intent._id,
            "chat.read.updated",
            {
              conversationId: conversation.id,
              readerId: intent.readerId,
              lastReadSequence: intent.lastReadSequence,
            },
          );
        });
        await this.chat.acknowledgeIntent(intent._id);
      }
    } finally {
      this.busy = false;
    }
  }
}
