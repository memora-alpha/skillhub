import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection, mongo } from "mongoose";
import { randomUUID } from "node:crypto";
import { fingerprintCommand } from "../../../../infrastructure/idempotency/idempotency.service";
import type { JsonValue } from "../../../../infrastructure/idempotency/idempotency.types";

export type ChatAttachment = {
  attachmentId: string;
  fileId: string;
  generation: number;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  checksum: string;
};
export type ChatMessage = {
  _id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  messageText: string;
  messageType: "TEXT" | "FILE" | "SYSTEM";
  attachments: ChatAttachment[];
  commandDigest: string;
  draftDigest: string;
  draftFormatVersion: number;
  status: "DRAFT" | "PUBLISHED";
  sequence: mongo.Long | null;
  sentAt: Date | null;
  objectType?: string;
  objectId?: string;
  objectVersion?: number;
};
type Counter = { _id: string; sequence: mongo.Long };
type ReadState = {
  _id: string;
  conversationId: string;
  userId: string;
  lastReadSequence: mongo.Long;
  lastReadAt: Date;
  revision: number;
};
export type ReadIntent = {
  _id: string;
  conversationId: string;
  readerId: string;
  lastReadSequence: string;
  createdAt: Date;
  bridgedAt: Date | null;
};
export function draftDigest(
  message: Pick<
    ChatMessage,
    | "_id"
    | "conversationId"
    | "senderId"
    | "clientMessageId"
    | "messageText"
    | "messageType"
    | "attachments"
    | "commandDigest"
    | "draftFormatVersion"
    | "objectType"
    | "objectId"
    | "objectVersion"
  >,
) {
  return fingerprintCommand(
    JSON.parse(
      JSON.stringify({
        _id: message._id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        clientMessageId: message.clientMessageId,
        messageText: message.messageText,
        messageType: message.messageType,
        attachments: message.attachments,
        commandDigest: message.commandDigest,
        draftFormatVersion: message.draftFormatVersion,
        ...(message.objectType
          ? {
              objectType: message.objectType,
              objectId: message.objectId,
              objectVersion: message.objectVersion,
            }
          : {}),
      }),
    ) as JsonValue,
  );
}
export function publicMessage(
  message: ChatMessage,
  oppositeRead?: ReadState | null,
) {
  return {
    id: message._id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    messageText: message.messageText,
    messageType: message.messageType,
    attachments: message.attachments.map((file) => ({
      attachmentId: file.attachmentId,
      fileId: file.fileId,
      filename: file.filename,
      mimeType: file.mimeType,
      fileSizeBytes: file.fileSizeBytes,
      downloadUrlEndpoint: `/api/v1/conversations/${message.conversationId}/messages/${message._id}/attachments/${file.attachmentId}/download`,
    })),
    ...(message.objectType
      ? {
          objectType: message.objectType,
          objectId: message.objectId,
          objectVersion: message.objectVersion,
        }
      : {}),
    sequence: message.sequence!.toString(),
    sentAt: message.sentAt,
    readAt:
      oppositeRead &&
      message.sequence!.lessThanOrEqual(oppositeRead.lastReadSequence)
        ? oppositeRead.lastReadAt
        : null,
  };
}
@Injectable()
export class ChatRepository {
  private checked = false;
  constructor(@InjectConnection() private readonly connection: Connection) {}
  private get db() {
    if (!this.connection.db)
      throw new ServiceUnavailableException("CHAT_STORE_UNAVAILABLE");
    return this.connection.db;
  }
  private get messages() {
    return this.db.collection<ChatMessage>("chat_messages", {
      promoteLongs: false,
    });
  }
  private get counters() {
    return this.db.collection<Counter>("chat_counters", {
      promoteLongs: false,
    });
  }
  private get reads() {
    return this.db.collection<ReadState>("chat_read_states", {
      promoteLongs: false,
    });
  }
  private get intents() {
    return this.db.collection<ReadIntent>("chat_event_intents");
  }
  async ready() {
    if (this.checked) return;
    try {
      const hello = await this.db.admin().command({ hello: 1 });
      if (!hello.setName)
        throw new Error("Chat requires a MongoDB replica set");
      const indexes = await this.messages.listIndexes().toArray();
      if (
        !indexes.some(
          (index) => index.name === "published_sequence" && index.unique,
        ) ||
        !indexes.some(
          (index) => index.name === "sender_identity" && index.unique,
        )
      )
        throw new Error("Chat requires the configured message indexes");
      this.checked = true;
    } catch {
      throw new ServiceUnavailableException(
        "CHAT_REPLICA_SET_OR_INDEXES_UNAVAILABLE",
      );
    }
  }
  async get(id: string) {
    await this.ready();
    return this.messages.findOne(
      { _id: id },
      { readConcern: { level: "majority" } },
    );
  }
  async draft(
    input: Omit<ChatMessage, "status" | "sequence" | "sentAt" | "draftDigest">,
  ) {
    await this.ready();
    const message: ChatMessage = {
      ...input,
      draftDigest: draftDigest(input),
      status: "DRAFT",
      sequence: null,
      sentAt: null,
    };
    try {
      await this.messages.updateOne(
        { _id: input._id },
        { $setOnInsert: message },
        { upsert: true, writeConcern: { w: "majority" } },
      );
    } catch (error) {
      if (!(error instanceof mongo.MongoServerError && error.code === 11000))
        throw error;
    }
    const stored = await this.messages.findOne(
      { _id: input._id },
      { readConcern: { level: "majority" } },
    );
    if (
      stored?.commandDigest !== input.commandDigest ||
      stored.draftFormatVersion !== 1 ||
      draftDigest(stored) !== stored.draftDigest
    )
      throw new ConflictException("MESSAGE_DRAFT_CONFLICT");
    return stored;
  }
  async publish(id: string, expectedDigest: string) {
    await this.ready();
    const session = await this.connection.startSession();
    try {
      return await session.withTransaction(
        async () => {
          const row = await this.messages.findOne({ _id: id }, { session });
          if (
            row?.draftDigest !== expectedDigest ||
            draftDigest(row) !== expectedDigest
          )
            throw new Error("COMMITTED_DRAFT_MISSING_OR_CHANGED");
          if (row.status === "PUBLISHED") return row;
          const counter = await this.counters.findOneAndUpdate(
            { _id: row.conversationId },
            { $inc: { sequence: mongo.Long.ONE } },
            { upsert: true, returnDocument: "after", session },
          );
          if (!counter) throw new Error("MESSAGE_SEQUENCE_UNAVAILABLE");
          const updated = await this.messages.findOneAndUpdate(
            { _id: id, status: "DRAFT" },
            {
              $set: {
                status: "PUBLISHED",
                sequence: counter.sequence,
                sentAt: new Date(),
              },
            },
            { returnDocument: "after", session },
          );
          if (!updated) throw new Error("MESSAGE_PUBLICATION_CONFLICT");
          return updated;
        },
        { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
      );
    } finally {
      await session.endSession();
    }
  }
  async history(
    conversationId: string,
    limit: number,
    before?: string,
    after?: string,
  ) {
    await this.ready();
    const resolveRows = () => {
      if (before) {
        return { sequence: { $lt: mongo.Long.fromString(before) } };
      }
      if (after) {
        return { sequence: { $gt: mongo.Long.fromString(after) } };
      }
      return {};
    };
    const rows = await this.messages
      .find({
        conversationId,
        status: "PUBLISHED",
        ...resolveRows(),
      })
      .sort({ sequence: after ? 1 : -1 })
      .limit(limit + 1)
      .toArray();
    const more = rows.length > limit;
    const selected = rows.slice(0, limit);
    if (!after) selected.reverse();
    return { rows: selected, more };
  }
  async readState(conversationId: string, userId: string) {
    await this.ready();
    return this.reads.findOne({ _id: `${conversationId}:${userId}` });
  }
  async advanceRead(conversationId: string, userId: string, messageId: string) {
    await this.ready();
    const session = await this.connection.startSession();
    try {
      return await session.withTransaction(
        async () => {
          const message = await this.messages.findOne(
            { _id: messageId, conversationId, status: "PUBLISHED" },
            { session },
          );
          if (!message?.sequence) return null;
          const _id = `${conversationId}:${userId}`,
            current = await this.reads.findOne({ _id }, { session });
          if (current?.lastReadSequence.greaterThanOrEqual(message.sequence))
            return current;
          const next: ReadState = {
            _id,
            conversationId,
            userId,
            lastReadSequence: message.sequence,
            lastReadAt: new Date(),
            revision: (current?.revision ?? 0) + 1,
          };
          await this.reads.replaceOne({ _id }, next, { upsert: true, session });
          await this.intents.insertOne(
            {
              _id: randomUUID(),
              conversationId,
              readerId: userId,
              lastReadSequence: message.sequence.toString(),
              createdAt: next.lastReadAt,
              bridgedAt: null,
            },
            { session },
          );
          return next;
        },
        { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
      );
    } finally {
      await session.endSession();
    }
  }
  async pendingIntents() {
    await this.ready();
    return this.intents.find({ bridgedAt: null }).limit(100).toArray();
  }
  async acknowledgeIntent(id: string) {
    await this.intents.updateOne(
      { _id: id, bridgedAt: null },
      { $set: { bridgedAt: new Date() } },
    );
  }
}
