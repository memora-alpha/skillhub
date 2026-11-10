import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
} from "../../../../infrastructure/events/outbox.types";
import {
  ChatRepository,
  draftDigest,
} from "../../infrastructure/persistence/chat.repository";
import {
  systemMessageDraft,
  systemMessageEventSchema,
} from "../../domain/system-message";
import { ChatPublicationService } from "./chat-publication.service";

@Injectable()
export class SystemMessagePublisher implements OnModuleInit {
  constructor(
    private readonly registry: OutboxPublisherRegistry,
    private readonly db: PrismaService,
    private readonly chat: ChatRepository,
    private readonly publications: ChatPublicationService,
  ) {}

  onModuleInit(): void {
    this.registry.register("chat.system.publish", this);
  }

  async publish(event: OutboxMessage): Promise<void> {
    const payload = systemMessageEventSchema.parse(event.payload);
    if (
      event.type !== "chat.system.publish" ||
      event.version !== 1 ||
      event.eventId !== payload.messageId
    ) {
      throw new Error("INVALID_SYSTEM_MESSAGE_EVENT");
    }
    const { messageId, ...input } = payload;
    const draft = systemMessageDraft(messageId, input);
    const receipt = await this.db.chatPublication.findUniqueOrThrow({
      where: { id: messageId },
    });
    if (
      receipt.conversationId !== input.conversationId ||
      receipt.senderId !== input.senderId ||
      receipt.clientMessageId !== messageId ||
      receipt.commandDigest !== draft.commandDigest ||
      receipt.draftDigest !== draftDigest(draft) ||
      !["COMMITTED", "DELIVERED"].includes(receipt.status)
    ) {
      throw new Error("SYSTEM_MESSAGE_INTENT_MISMATCH");
    }
    if (receipt.status === "DELIVERED") return;
    // The outbox snapshot recreates a missing draft; _id and digest make all
    // retries (including a crash after Mongo commit) use the same message.
    await this.chat.draft(draft);
    await this.publications.deliver(messageId);
  }
}
