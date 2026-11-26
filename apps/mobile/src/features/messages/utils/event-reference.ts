import { z } from "zod";
import { AppError } from "@/lib/http/errors";
import { parse, uuid, sequence } from "@/lib/http/contracts";
import type { SseFrame } from "./sse-parser";

type Prefix = readonly unknown[];
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

export function chatEventReference(frame: SseFrame):
  | {
      eventId: string;
      prefixes: Prefix[];
      receiptsFor?: string;
      attachmentsFor?: string;
    }
  | undefined {
  const known =
    proposalEvents.has(frame.event) ||
    [
      "chat.message.created",
      "chat.delivery.updated",
      "chat.read.updated",
      "chat.attachment.updated",
      "chat.attachment.availability.updated",
      "notification.created",
      "notification.read",
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
  let attachmentsFor: string | undefined;
  if (
    frame.event === "notification.created" ||
    frame.event === "notification.read"
  ) {
    parse(z.object({ notificationId: uuid }), value.data);
    prefixes = [["notifications"]];
  } else if (proposalEvents.has(frame.event)) {
    const { proposalId } = parse(z.object({ proposalId: uuid }), value.data);
    prefixes = [
      ["proposals"],
      ["proposal", proposalId],
      ["conversations", "inbox"],
    ];
    if (frame.event === "proposal.accepted") prefixes.push(["conversations"]);
  } else if (frame.event === "chat.attachment.availability.updated") {
    const { conversationId } = parse(
      z.object({
        conversationId: uuid,
        messageId: uuid,
        fileId: uuid,
        stateRevision: sequence.optional(),
      }),
      value.data,
    );
    prefixes = [
      ["thread", conversationId],
      ["conversations", "preview", conversationId],
    ];
    attachmentsFor = conversationId;
  } else if (frame.event === "chat.attachment.updated") {
    parse(z.object({ fileId: uuid }), value.data);
    prefixes = [["chat-file"]];
  } else if (frame.event === "chat.read.updated") {
    const { conversationId } = parse(read, value.data);
    prefixes = [
      ["thread", conversationId],
      ["conversations", "preview", conversationId],
    ];
    receiptsFor = conversationId;
  } else {
    const { conversationId } = parse(message, value.data);
    prefixes = [
      ["thread", conversationId],
      ["conversations", "preview", conversationId],
      ["conversations", "inbox"],
    ];
    if (frame.event === "chat.delivery.updated")
      prefixes.push(["delivery", conversationId]);
  }
  return { eventId: value.eventId, prefixes, receiptsFor, attachmentsFor };
}
