import { z } from "zod";
import type { QueryClient } from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import { parse, uuid, sequence } from "@/lib/http/contracts";
import type { SseFrame } from "./sse-parser";

type Prefix = readonly unknown[];
const recoveryPrefixes: Prefix[] = [
  ["conversations"],
  ["conversation-preview"],
  ["conversation"],
  ["thread"],
  ["delivery"],
  ["chat-file"],
  ["proposals"],
  ["proposal"],
];
const envelope = z.object({
  eventId: uuid,
  version: z.literal(1),
  data: z.unknown(),
});
const message = z.object({
  conversationId: uuid,
  messageId: uuid,
  messageSequence: sequence,
});
const read = z.object({
  conversationId: uuid,
  readerId: uuid,
  lastReadSequence: sequence,
});
const proposalEvents = new Set([
  "proposal.created",
  "proposal.updated",
  "proposal.accepted",
  "proposal.rejected",
  "proposal.withdrawn",
  "proposal.expired",
]);

function reference(
  frame: SseFrame,
): { eventId: string; prefixes: Prefix[]; receiptsFor?: string } | undefined {
  const known =
    proposalEvents.has(frame.event) ||
    [
      "chat.message.created",
      "chat.delivery.updated",
      "chat.read.updated",
      "chat.attachment.updated",
    ].includes(frame.event);
  if (!known) return;
  let json: unknown;
  try {
    json = JSON.parse(frame.data);
  } catch {
    throw new AppError("protocol");
  }
  const value = parse(envelope, json);
  let prefixes: Prefix[];
  let receiptsFor: string | undefined;
  if (proposalEvents.has(frame.event)) {
    const { proposalId } = parse(z.object({ proposalId: uuid }), value.data);
    prefixes = [["proposals"], ["proposal", proposalId]];
    if (frame.event === "proposal.accepted") prefixes.push(["conversations"]);
  } else if (frame.event === "chat.attachment.updated") {
    parse(z.object({ fileId: uuid }), value.data);
    prefixes = [["chat-file"]];
  } else if (frame.event === "chat.read.updated") {
    const { conversationId } = parse(read, value.data);
    prefixes = [["thread", conversationId]];
    receiptsFor = conversationId;
  } else {
    const { conversationId } = parse(message, value.data);
    prefixes = [
      ["thread", conversationId],
      ["conversations"],
      ["conversation-preview", conversationId],
    ];
    if (frame.event === "chat.delivery.updated")
      prefixes.push(["delivery", conversationId]);
  }
  return { eventId: value.eventId, prefixes, receiptsFor };
}

export function reloadChatEventQueries(
  cache: QueryClient,
  base: Prefix,
  prefixes: readonly Prefix[],
  receiptsFor?: string,
) {
  const markReceipts = (id: string) =>
    cache.setQueryData<number>(
      [...base, "thread-receipts", id],
      (revision = 0) => revision + 1,
    );
  if (receiptsFor) markReceipts(receiptsFor);
  // A fresh stream starts at the server head. Refresh read receipts missed offline,
  // including messages in already loaded older pages.
  if (
    prefixes.some((prefix) => prefix.length === 1 && prefix[0] === "thread")
  ) {
    cache
      .getQueryCache()
      .findAll({ queryKey: [...base, "thread"] })
      .forEach((query) => {
        const id = query.queryKey[base.length + 1];
        if (typeof id === "string") markReceipts(id);
      });
  }
  return Promise.all(
    prefixes.map((prefix) =>
      cache.invalidateQueries(
        { queryKey: [...base, ...prefix] },
        { throwOnError: true },
      ),
    ),
  );
}

// Cursor acknowledgment follows a successful snapshot reload. A checkpoint only
// skips an event the server has explicitly hidden; it must not trigger reads.
export function createChatEventHydrator(options: {
  reload: (prefixes: Prefix[], receiptsFor?: string) => Promise<unknown>;
  assertCurrent: () => void;
  renew: () => Promise<unknown>;
  ready: () => void;
}) {
  let cursor: string | undefined;
  const processed = new Set<string>();
  const reset = () => {
    cursor = undefined;
    processed.clear();
  };
  const reloadReady = async (signal: AbortSignal) => {
    await options.reload(recoveryPrefixes);
    if (signal.aborted) return;
    options.assertCurrent();
    options.ready();
  };
  const reloadEvent = async (frame: SseFrame, signal: AbortSignal) => {
    const event = reference(frame);
    if (!event || processed.has(event.eventId)) return;
    await options.reload(event.prefixes, event.receiptsFor);
    if (signal.aborted) return;
    options.assertCurrent();
    processed.add(event.eventId);
    if (processed.size > 500)
      processed.delete(processed.values().next().value!);
  };
  return {
    get cursor() {
      return cursor;
    },
    reset,
    async handle(frame: SseFrame, signal: AbortSignal) {
      if (signal.aborted) return;
      options.assertCurrent();
      if (frame.event === "stream.reauth-required") {
        await options.renew();
        throw new AppError("http", 401);
      }
      if (frame.event === "stream.reset-required") {
        reset();
        throw new AppError("http", 409, "EVENT_CURSOR_EXPIRED");
      }
      if (frame.event === "stream.ready") {
        await reloadReady(signal);
      } else {
        await reloadEvent(frame, signal);
      }
      if (!signal.aborted && frame.id !== undefined) cursor = frame.id;
    },
  };
}
