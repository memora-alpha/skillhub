import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import {
  parse,
  parsePage,
  resourcePath,
  pageQuery,
  uuid,
  version,
  timestamp,
  sequence,
} from "@/lib/http/contracts";

export const conversationSchema = z.object({
  id: uuid,
  proposalId: uuid,
  learningRequestId: uuid.nullable(),
  participantAId: uuid,
  participantBId: uuid,
  createdAt: timestamp,
});
export const attachmentSchema = z.object({
  attachmentId: uuid,
  fileId: uuid,
  filename: z.string(),
  mimeType: z.string(),
  fileSizeBytes: z.number().int().nonnegative(),
  downloadUrlEndpoint: z.string(),
});
export const messageSchema = z.object({
  id: uuid,
  conversationId: uuid,
  senderId: uuid,
  messageText: z.string(),
  messageType: z.enum(["TEXT", "FILE", "SYSTEM"]),
  attachments: z.array(attachmentSchema),
  sequence,
  sentAt: timestamp,
  readAt: timestamp.nullable(),
  objectType: z.string().optional(),
  objectId: uuid.optional(),
  objectVersion: version.optional(),
});
export const deliverySchema = z.discriminatedUnion("deliveryStatus", [
  z.object({ deliveryStatus: z.literal("DELIVERED"), message: messageSchema }),
  z.object({
    deliveryStatus: z.enum(["PREPARING", "PENDING"]),
    messageId: uuid,
    clientMessageId: uuid,
    statusUrl: z.string(),
    failureCode: z.string().nullable(),
  }),
]);
export type ApiConversation = z.infer<typeof conversationSchema>;
export type ApiMessage = z.infer<typeof messageSchema>;
export type Delivery = z.infer<typeof deliverySchema>;
export type MessageBubbleModel = {
  id: string;
  from: "them" | "me";
  text: string;
  time: string;
  file?: { name: string; bytes: number };
};
export type MessageDraft = {
  clientMessageId: string;
  messageText?: string;
  attachmentFileIds?: string[];
};
export function mergeMessages(...groups: ApiMessage[][]) {
  return [
    ...new Map(groups.flat().map((message) => [message.id, message])).values(),
  ].sort((a, b) => {
    const first = BigInt(a.sequence),
      second = BigInt(b.sequence);
    if (first < second) return -1;
    return first > second ? 1 : 0;
  });
}
export function createMessagesApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
  userId: string,
) {
  const root = (id: string) => resourcePath("conversations", id);
  const member = (item: ApiConversation, id?: string) => {
    if (
      (id && item.id !== id) ||
      ![item.participantAId, item.participantBId].includes(userId)
    )
      throw new AppError("protocol");
    return item;
  };
  const message = (item: ApiMessage, id: string) => {
    if (item.conversationId !== id) throw new AppError("protocol");
    return item;
  };
  const delivery = (result: unknown, id: string, clientMessageId: string) => {
    const parsed = parse(deliverySchema, result);
    if (parsed.deliveryStatus === "DELIVERED") {
      message(parsed.message, id);
      if (parsed.message.senderId !== userId) throw new AppError("protocol");
    } else if (parsed.clientMessageId !== clientMessageId)
      throw new AppError("protocol");
    return parsed;
  };
  return {
    async list(cursor?: string, signal?: AbortSignal) {
      const page = parsePage(
        conversationSchema,
        await call(`/conversations?${pageQuery(cursor)}`, {
          includeMeta: true,
          signal,
        }),
      );
      page.items.forEach((item) => member(item));
      return page;
    },
    async detail(id: string, signal?: AbortSignal) {
      return member(
        parse(conversationSchema, await call(root(id), { signal })),
        id,
      );
    },
    async history(
      id: string,
      options: {
        cursor?: string;
        afterSequence?: string;
        limit?: number;
        signal?: AbortSignal;
      } = {},
    ) {
      if (options.cursor && options.afterSequence)
        throw new AppError("protocol");
      const query = pageQuery(options.cursor);
      if (options.limit !== undefined)
        query.set(
          "limit",
          String(parse(z.number().int().min(1).max(100), options.limit)),
        );
      if (options.afterSequence)
        query.set("afterSequence", parse(sequence, options.afterSequence));
      const page = parsePage(
        messageSchema,
        await call(`${root(id)}/messages?${query}`, {
          includeMeta: true,
          signal: options.signal,
        }),
        options.afterSequence !== undefined,
      );
      page.items.forEach((item) => {
        message(item, id);
        if (
          options.afterSequence &&
          BigInt(item.sequence) <= BigInt(options.afterSequence)
        )
          throw new AppError("protocol");
      });
      return page;
    },
    async send(id: string, body: MessageDraft, signal?: AbortSignal) {
      parse(uuid, body.clientMessageId);
      return delivery(
        await call(`${root(id)}/messages`, {
          method: "POST",
          body,
          ...(signal ? { signal } : {}),
        }),
        id,
        body.clientMessageId,
      );
    },
    async delivery(id: string, clientMessageId: string, signal?: AbortSignal) {
      parse(uuid, clientMessageId);
      return delivery(
        await call(
          `${root(id)}/message-deliveries/${clientMessageId}`,
          ...(signal ? [{ signal }] : []),
        ),
        id,
        clientMessageId,
      );
    },
    async read(id: string, messageId: string) {
      parse(uuid, messageId);
      return parse(
        z.object({ lastReadSequence: sequence, lastReadAt: timestamp }),
        await call(`${root(id)}/read`, {
          method: "POST",
          body: { messageId },
          replayAfterRenewal: false,
        }),
      );
    },
    async upload(id: string, body: FormData) {
      return parse(
        z.object({ fileId: uuid, state: z.literal("QUARANTINED") }),
        await call(`${root(id)}/attachments`, {
          method: "POST",
          body,
          multipart: true,
          replayAfterRenewal: false,
        }),
      );
    },
    async fileStatus(id: string, fileId: string) {
      parse(uuid, fileId);
      const result = parse(
        z.object({
          fileId: uuid,
          state: z.string(),
          generation: z.number().int(),
        }),
        await call(`${root(id)}/attachments/${fileId}/status`),
      );
      if (result.fileId !== fileId) throw new AppError("protocol");
      return result;
    },
    async download(id: string, messageId: string, attachmentId: string) {
      parse(uuid, messageId);
      parse(uuid, attachmentId);
      return parse(
        z.object({
          url: z.url().refine((value) => /^https?:\/\//.test(value)),
          expiresAt: timestamp,
        }),
        await call(
          `${root(id)}/messages/${messageId}/attachments/${attachmentId}/download`,
        ),
      );
    },
  };
}
