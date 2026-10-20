import assert from "node:assert/strict";
import test from "node:test";
import { chatTimeline } from "../src/features/messages/utils/chat-timeline";
import { published, chatId } from "./fixtures/chat-outbox";
import { fixtureId } from "./fixtures/learning-requests-data";
import type { QueuedText } from "../src/features/messages/outbox/outbox-types";

const queued = (n: number): QueuedText => ({
  clientMessageId: fixtureId(800 + n),
  conversationId: chatId,
  messageText: "Hai tin có cùng nội dung",
  createdAt: "2026-10-19T10:00:00.000Z",
  state: "queued",
  phase: "send",
  attempts: 0,
  retryAt: 0,
});
test("queued bubbles never invent server sequences or collapse messages with identical text", () => {
  const items = chatTimeline([], [queued(1), queued(2)]);
  assert.equal(items.length, 2);
  assert.ok(
    items.every(
      (item) => item.kind === "queued" && !("sequence" in item.entry),
    ),
  );
  assert.notEqual(items[0]!.id, items[1]!.id);
});
test("history/SSE and receipts reconcile by message ID, not by text or local sequence", () => {
  const message = published(queued(1));
  const pending = {
    ...queued(1),
    state: "processing" as const,
    messageId: message.id,
  };
  assert.deepEqual(chatTimeline([message], [pending]), [
    { kind: "message", id: message.id, message },
  ]);
  const ack = { ...pending, state: "sent" as const, message };
  assert.deepEqual(chatTimeline([], [ack]), [
    { kind: "message", id: message.id, message },
  ]);
  assert.equal(chatTimeline([message], [ack, queued(2)]).length, 2);
});
