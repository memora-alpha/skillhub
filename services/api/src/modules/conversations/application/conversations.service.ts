import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import { TransactionRunner } from "../../../infrastructure/database/transaction-runner";
import { OutboxWriter } from "../../../infrastructure/events/outbox-writer";
import { fingerprintCommand } from "../../../infrastructure/idempotency/idempotency.service";
import { FileAttachmentService } from "../../../infrastructure/storage/file-attachment.service";
import { FileStorageService } from "../../../infrastructure/storage/file-storage.service";
import type { Principal } from "../../auth/application/services/sessions.service";
import { SkillActorService } from "../../users/application/services/skill-actor.service";
import { ConnectionConfig } from "../../proposals/domain/connection-config";
import { normalizeMessage } from "../../proposals/domain/connection-policy";
import {
  cursorScope,
  readCursor,
  page,
} from "../../skills/domain/skill-policy";
import {
  ChatRepository,
  draftDigest,
  publicMessage,
} from "../infrastructure/chat.repository";
import { ConversationAccessService } from "./conversation-access.service";
import { ChatPublicationService } from "./chat-publication.service";
import type { RequestContext } from "../../../shared/http/request-context";
import { conversationView } from "../domain/conversation-view";

@Injectable()
export class ConversationsService {
  constructor(
    private readonly db: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly access: ConversationAccessService,
    private readonly actors: SkillActorService,
    private readonly config: ConnectionConfig,
    private readonly chat: ChatRepository,
    private readonly publications: ChatPublicationService,
    private readonly files: FileAttachmentService,
    private readonly storage: FileStorageService,
    private readonly outbox: OutboxWriter,
  ) {}
  async get(principal: Principal, id: string) {
    return this.transactions.run(async (tx) =>
      conversationView(
        (await this.access.require(tx, principal, id)).conversation,
      ),
    );
  }
  async list(principal: Principal, query: { limit?: number; cursor?: string }) {
    const limit = query.limit ?? 20,
      scope = cursorScope({ type: "conversations", viewer: principal.userId }),
      cursor = readCursor(query.cursor, scope);
    return this.transactions.run(async (tx) => {
      await this.actors.require(tx, principal, "conversation:read:participant");
      const result = page(
        await tx.conversation.findMany({
          where: {
            OR: [
              { participantAId: principal.userId },
              { participantBId: principal.userId },
            ],
            ...(cursor ? { id: { gt: cursor.id } } : {}),
          },
          orderBy: { id: "asc" },
          take: limit + 1,
        }),
        limit,
        scope,
        (row) => row.id,
      );
      return { ...result, data: result.data.map(conversationView) };
    });
  }
  async send(
    principal: Principal,
    id: string,
    input: {
      clientMessageId: string;
      messageText?: string;
      attachmentFileIds?: string[];
    },
    context: RequestContext,
  ) {
    const body = normalizeMessage(input),
      commandDigest = fingerprintCommand(body);
    await this.chat.ready(); // fail before allocating a receipt when transaction/index prerequisites are absent
    const receipt = await this.transactions.run(async (tx) => {
      await this.access.require(
        tx,
        principal,
        id,
        "message:create:participant",
        true,
      );
      const existing = await tx.chatPublication.findUnique({
        where: {
          conversationId_senderId_clientMessageId: {
            conversationId: id,
            senderId: principal.userId,
            clientMessageId: input.clientMessageId,
          },
        },
      });
      if (existing) {
        if (existing.commandDigest !== commandDigest)
          throw new ConflictException("MESSAGE_IDEMPOTENCY_CONFLICT");
        if (existing.status === "CANCELLED")
          throw new ConflictException("MESSAGE_CANCELLED");
        return existing;
      }
      const clocks = await tx.$queryRaw<
          { now: Date }[]
        >`SELECT clock_timestamp() AS now`,
        since = new Date(clocks[0]!.now.getTime() - 60000);
      const userCount = await tx.chatPublication.count({
        where: { senderId: principal.userId, createdAt: { gt: since } },
      });
      const conversationCount = await tx.chatPublication.count({
        where: { conversationId: id, createdAt: { gt: since } },
      });
      if (
        userCount >= this.config.policy.messagesPerMinuteUser ||
        conversationCount >= this.config.policy.messagesPerMinuteConversation
      )
        throw new HttpException("CHAT_RATE_LIMIT", 429);
      return tx.chatPublication.create({
        data: {
          id: randomUUID(),
          conversationId: id,
          senderId: principal.userId,
          clientMessageId: input.clientMessageId,
          commandDigest,
          deliveredEventId: randomUUID(),
        },
      });
    });
    if (receipt.status === "DELIVERED")
      return this.delivery(principal, id, input.clientMessageId);
    let draft = await this.chat.get(receipt.id);
    if (!draft) {
      if (receipt.status !== "PREPARING")
        throw new ServiceUnavailableException("COMMITTED_DRAFT_MISSING");
      const manifest = await this.transactions.run(async (tx) => {
        await this.access.require(
          tx,
          principal,
          id,
          "message:create:participant",
          true,
        );
        await tx.$queryRaw`SELECT id FROM chat_publications WHERE id=${receipt.id}::uuid FOR UPDATE`;
        return this.files.chatManifest(
          tx,
          principal.userId,
          body.attachmentFileIds,
          receipt.id,
        );
      });
      draft = await this.chat.draft({
        _id: receipt.id,
        conversationId: id,
        senderId: principal.userId,
        clientMessageId: input.clientMessageId,
        messageText: body.messageText,
        messageType: manifest.length ? "FILE" : "TEXT",
        attachments: manifest.map((file) => ({
          ...file,
          attachmentId: randomUUID(),
        })),
        commandDigest,
        draftFormatVersion: 1,
      });
    }
    const immutableDraft = draft;
    if (
      immutableDraft.commandDigest !== commandDigest ||
      immutableDraft.draftFormatVersion !== 1 ||
      draftDigest(immutableDraft) !== immutableDraft.draftDigest
    )
      throw new ConflictException("MESSAGE_DRAFT_CONFLICT");
    await this.transactions.run(async (tx) => {
      await this.access.require(
        tx,
        principal,
        id,
        "message:create:participant",
        true,
      );
      await tx.$queryRaw`SELECT id FROM chat_publications WHERE id=${receipt.id}::uuid FOR UPDATE`;
      const current = await tx.chatPublication.findUniqueOrThrow({
        where: { id: receipt.id },
      });
      if (current.status === "CANCELLED")
        throw new ConflictException("MESSAGE_CANCELLED");
      if (current.status !== "PREPARING") {
        if (current.draftDigest !== immutableDraft.draftDigest)
          throw new ConflictException("MESSAGE_DRAFT_CONFLICT");
        return;
      }
      const manifest = await this.files.chatManifest(
        tx,
        principal.userId,
        body.attachmentFileIds,
        receipt.id,
        true,
      );
      const expected = immutableDraft.attachments.map(
        ({ attachmentId, ...file }) => {
          void attachmentId;
          return file;
        },
      );
      if (fingerprintCommand(manifest) !== fingerprintCommand(expected))
        throw new ConflictException("FILE_MANIFEST_CHANGED");
      await tx.chatPublication.update({
        where: { id: receipt.id },
        data: { status: "COMMITTED", draftDigest: immutableDraft.draftDigest },
      });
      await this.outbox.append(tx, {
        eventId: receipt.id,
        type: "chat.message.publish",
        version: 1,
        correlationId: context.correlationId,
        payload: { messageId: receipt.id },
      });
    });
    // The durable worker is authoritative. A bounded synchronous attempt improves latency.
    // Queue acceptance alone always returns PENDING, never DELIVERED.
    let attemptTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.publications.deliver(receipt.id).catch(() => undefined),
        new Promise<void>((resolve) => {
          attemptTimer = setTimeout(resolve, 1000);
        }),
      ]);
    } finally {
      if (attemptTimer) clearTimeout(attemptTimer);
    }
    return this.delivery(principal, id, input.clientMessageId);
  }
  async delivery(principal: Principal, id: string, clientMessageId: string) {
    const receipt = await this.transactions.run(async (tx) => {
      await this.access.require(
        tx,
        principal,
        id,
        "message:delivery:read:self",
      );
      const row = await tx.chatPublication.findUnique({
        where: {
          conversationId_senderId_clientMessageId: {
            conversationId: id,
            senderId: principal.userId,
            clientMessageId,
          },
        },
      });
      if (!row) throw new NotFoundException();
      return row;
    });
    if (receipt.status === "DELIVERED") {
      const message = await this.chat.get(receipt.id);
      if (
        message?.status !== "PUBLISHED" ||
        message.draftDigest !== receipt.draftDigest ||
        message.sequence?.toString() !== receipt.messageSequence?.toString()
      )
        throw new ServiceUnavailableException("MESSAGE_NOT_READY");
      // Mongo I/O must not carry authorization across a concurrent session/account change.
      await this.transactions.run((tx) =>
        this.access.require(tx, principal, id, "message:delivery:read:self"),
      );
      return {
        deliveryStatus: "DELIVERED" as const,
        message: publicMessage(message),
      };
    }
    return {
      deliveryStatus:
        receipt.status === "PREPARING"
          ? ("PREPARING" as const)
          : ("PENDING" as const),
      messageId: receipt.id,
      clientMessageId,
      statusUrl: `/api/v1/conversations/${id}/message-deliveries/${clientMessageId}`,
      failureCode: receipt.failureCode,
    };
  }
  async history(
    principal: Principal,
    id: string,
    query: { limit?: number; cursor?: string; afterSequence?: string },
  ) {
    const conversation = await this.get(principal, id),
      limit = query.limit ?? 20;
    const scope = cursorScope({
      type: "messages",
      viewer: principal.userId,
      conversation: id,
    });
    let before: string | undefined;
    if (query.cursor) {
      try {
        if (query.cursor.length > 1024) throw new Error();
        const cursor: unknown = JSON.parse(
          Buffer.from(query.cursor, "base64url").toString(),
        );
        if (
          !cursor ||
          typeof cursor !== "object" ||
          !("scope" in cursor) ||
          cursor.scope !== scope ||
          !("sequence" in cursor) ||
          typeof cursor.sequence !== "string" ||
          !/^\d{1,19}$/.test(cursor.sequence)
        )
          throw new Error();
        before = cursor.sequence;
      } catch {
        throw new BadRequestException("INVALID_MESSAGE_CURSOR");
      }
    }
    if (before && query.afterSequence)
      throw new BadRequestException("INVALID_MESSAGE_CURSOR");
    for (const value of [before, query.afterSequence])
      if (value !== undefined && BigInt(value) > 9223372036854775807n)
        throw new BadRequestException("INVALID_MESSAGE_SEQUENCE");
    const rows = await this.chat.history(
      id,
      limit,
      before,
      query.afterSequence,
    );
    const other =
      conversation.participantAId === principal.userId
        ? conversation.participantBId
        : conversation.participantAId;
    const [readA, readB] = await Promise.all([
      this.chat.readState(id, principal.userId),
      this.chat.readState(id, other),
    ]);
    // Recheck authorization after external I/O before returning private content.
    await this.get(principal, id);
    const data = rows.rows.map((row) =>
      publicMessage(row, row.senderId === principal.userId ? readB : readA),
    );
    const next =
      rows.more && !query.afterSequence
        ? Buffer.from(
            JSON.stringify({
              scope,
              sequence: rows.rows[0]!.sequence!.toString(),
            }),
          ).toString("base64url")
        : null;
    return {
      data,
      pagination: { limit, hasMore: rows.more, nextCursor: next },
    };
  }
  async read(principal: Principal, id: string, messageId: string) {
    await this.transactions.run((tx) =>
      this.access.require(
        tx,
        principal,
        id,
        "conversation:read-state:update:self",
      ),
    );
    const state = await this.chat.advanceRead(id, principal.userId, messageId);
    if (!state) throw new NotFoundException();
    await this.get(principal, id);
    void this.publications.bridge().catch(() => undefined);
    return {
      lastReadSequence: state.lastReadSequence.toString(),
      lastReadAt: state.lastReadAt,
    };
  }
  async upload(
    principal: Principal,
    id: string,
    file: Express.Multer.File,
    context: RequestContext,
  ) {
    const { actor } = await this.transactions.run((tx) =>
      this.access.require(
        tx,
        principal,
        id,
        "message:attachment:create:participant",
      ),
    );
    return this.storage.upload({
      actor,
      purpose: "CHAT",
      name: file.originalname,
      claimedMime: file.mimetype,
      body: Readable.from(file.buffer),
      context,
    });
  }
  async attachmentStatus(principal: Principal, id: string, fileId: string) {
    await this.transactions.run((tx) =>
      this.access.require(
        tx,
        principal,
        id,
        "message:attachment:create:participant",
      ),
    );
    return this.files.chatStatus(principal.userId, fileId);
  }
  async download(
    principal: Principal,
    id: string,
    messageId: string,
    attachmentId: string,
  ) {
    const { actor } = await this.transactions.run((tx) =>
      this.access.require(
        tx,
        principal,
        id,
        "message:attachment:read:participant",
      ),
    );
    const message = await this.chat.get(messageId);
    const attachment =
      message?.status === "PUBLISHED" && message.conversationId === id
        ? message.attachments.find((file) => file.attachmentId === attachmentId)
        : null;
    if (!attachment) throw new NotFoundException();
    return this.storage.issueDownload(
      {
        actor,
        fileId: attachment.fileId,
        resource: { type: "CHAT_MESSAGE", id: messageId },
      },
      {
        assertRead: async () => {
          await this.transactions.run(async (tx) => {
            await this.access.require(
              tx,
              principal,
              id,
              "message:attachment:read:participant",
            );
            const bound = await this.files.assertBoundReady(
              tx,
              attachment.fileId,
              { type: "CHAT_MESSAGE", id: messageId },
            );
            if (
              bound.generation !== attachment.generation ||
              bound.sha256 !== attachment.checksum ||
              bound.sizeBytes !== attachment.fileSizeBytes ||
              bound.detectedMime !== attachment.mimeType
            )
              throw new NotFoundException();
          });
        },
      },
    );
  }
}
