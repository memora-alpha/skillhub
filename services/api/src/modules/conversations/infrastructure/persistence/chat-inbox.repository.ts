import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection, mongo } from "mongoose";
import { ChatRepository } from "./chat.repository";
import {
  inboxMessagePreview,
  type InboxLatestMessage,
  type InboxMessageSummary,
} from "../../domain/inbox-message-summary";

type MessageProjection = Omit<InboxLatestMessage, "id" | "preview"> & {
  _id: string;
  messageText: string;
};
type InboxRow = {
  _id: string;
  latest: MessageProjection | null;
  hasUnread: boolean;
};
export type ConversationInboxState = InboxMessageSummary & {
  conversationId: string;
};

@Injectable()
export class ChatInboxRepository {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly chat: ChatRepository,
  ) {}

  /** Only accepts PostgreSQL-authorized conversation IDs, at most one batch. */
  async read(
    conversationIds: string[],
    userId: string,
  ): Promise<ConversationInboxState[]> {
    if (!conversationIds.length) return [];
    await this.chat.ready();
    try {
      if (!this.connection.db) throw new Error("Chat store is unavailable");
      const rows = await this.connection.db
        .aggregate<InboxRow>(
          [
            { $documents: conversationIds.map((_id) => ({ _id })) },
            {
              $lookup: {
                from: "chat_messages",
                let: { conversation: "$_id" },
                as: "latest",
                pipeline: [
                  {
                    $match: {
                      status: "PUBLISHED",
                      $expr: { $eq: ["$conversationId", "$$conversation"] },
                    },
                  },
                  { $sort: { sequence: -1 } },
                  { $limit: 1 },
                  {
                    $project: {
                      _id: 1,
                      conversationId: 1,
                      senderId: 1,
                      messageType: 1,
                      messageText: 1,
                      sentAt: 1,
                    },
                  },
                ],
              },
            },
            {
              $lookup: {
                from: "chat_read_states",
                let: { readId: { $concat: ["$_id", ":", userId] } },
                as: "read",
                pipeline: [
                  { $match: { $expr: { $eq: ["$_id", "$$readId"] } } },
                  { $project: { _id: 0, lastReadSequence: 1 } },
                ],
              },
            },
            {
              $set: {
                watermark: {
                  $ifNull: [
                    { $arrayElemAt: ["$read.lastReadSequence", 0] },
                    mongo.Long.ZERO,
                  ],
                },
              },
            },
            {
              $lookup: {
                from: "chat_messages",
                let: { conversation: "$_id", watermark: "$watermark" },
                as: "unread",
                pipeline: [
                  {
                    $match: {
                      status: "PUBLISHED",
                      senderId: { $ne: userId },
                      $expr: {
                        $and: [
                          { $eq: ["$conversationId", "$$conversation"] },
                          { $gt: ["$sequence", "$$watermark"] },
                        ],
                      },
                    },
                  },
                  { $limit: 1 },
                  { $project: { _id: 1 } },
                ],
              },
            },
            {
              $project: {
                _id: 1,
                latest: { $ifNull: [{ $arrayElemAt: ["$latest", 0] }, null] },
                hasUnread: { $gt: [{ $size: "$unread" }, 0] },
              },
            },
          ],
          { maxTimeMS: 5000, readConcern: { level: "snapshot" } },
        )
        .toArray();
      if (
        rows.length !== conversationIds.length ||
        new Set(rows.map((row) => row._id)).size !== rows.length
      )
        throw new Error("Incomplete chat Inbox batch");
      return rows.map((row) => this.view(row));
    } catch {
      throw new ServiceUnavailableException("INBOX_MESSAGES_UNAVAILABLE");
    }
  }

  private view(row: InboxRow): ConversationInboxState {
    const message = row.latest;
    if (
      message &&
      (message.conversationId !== row._id ||
        !(message.sentAt instanceof Date) ||
        !Number.isFinite(message.sentAt.getTime()))
    )
      throw new Error("Invalid published Inbox message");
    return {
      conversationId: row._id,
      hasUnread: row.hasUnread,
      latestMessage: message
        ? {
            id: message._id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            messageType: message.messageType,
            preview: inboxMessagePreview(
              message.messageText,
              message.messageType,
            ),
            sentAt: message.sentAt,
          }
        : null,
    };
  }
}
