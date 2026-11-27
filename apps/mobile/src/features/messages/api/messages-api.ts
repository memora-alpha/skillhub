import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import { createChatFilesApi } from "./chat-files-api";
import {
  parse,
  parsePage,
  resourcePath,
  pageQuery,
  uuid,
  timestamp,
  sequence,
} from "@/lib/http/contracts";

import {
  conversationSchema,
  inboxGroupSchema,
  messageSchema,
  deliverySchema,
  type ApiConversation,
  type ApiMessage,
  type MessageDraft,
} from "./message-contracts";
export * from "./message-contracts";

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
    ...createChatFilesApi(call),
    async inbox(cursor?: string, signal?: AbortSignal) {
      return parsePage(
        inboxGroupSchema,
        await call(`/conversations/inbox?${pageQuery(cursor)}`, {
          includeMeta: true,
          signal,
        }),
      );
    },
    async list(
      cursor?: string,
      signal?: AbortSignal,
      learningRequestId?: string,
    ) {
      const query = pageQuery(cursor);
      if (learningRequestId)
        query.set("learningRequestId", parse(uuid, learningRequestId));
      const page = parsePage(
        conversationSchema,
        await call(`/conversations?${query}`, {
          includeMeta: true,
          signal,
        }),
      );
      for (const item of page.items) {
        member(item);
        if (learningRequestId && item.learningRequestId !== learningRequestId)
          throw new AppError("protocol");
      }
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
  };
}
