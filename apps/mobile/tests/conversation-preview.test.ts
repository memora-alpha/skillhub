import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  conversationInbox,
  newestMessage,
  knownInboxConversations,
  rememberLatestMessage,
} from "../src/features/messages/utils/conversation-preview";
import {
  createMessagesApi,
  type ApiConversation,
  type ApiMessage,
} from "../src/features/messages/api/messages-api";
import { published, ownerId } from "./fixtures/chat-outbox";
import { fixtureId } from "./fixtures/learning-requests-data";
import type { QueuedText } from "../src/features/messages/outbox/outbox-types";

const at = (hour: number) => `2026-10-19T${hour}:00:00.000Z`;
const conversation = (number: number, hour: number): ApiConversation => ({
  id: fixtureId(number),
  proposalId: fixtureId(number + 100),
  learningRequestId: null,
  participantAId: ownerId,
  participantBId: fixtureId(2),
  createdAt: at(hour),
});
const message = (id: string, hour: number, sequence = "1"): ApiMessage => ({
  ...published({
    clientMessageId: fixtureId(800),
    messageText: "Nội dung mới",
  }),
  conversationId: id,
  sentAt: at(hour),
  sequence,
});
const queued = (id: string, number: number, hour: number): QueuedText => ({
  clientMessageId: fixtureId(number),
  conversationId: id,
  messageText: `Tin ${number}`,
  createdAt: at(hour),
  state: "queued",
  phase: "send",
  attempts: 0,
  retryAt: 0,
});

test("a just-messaged conversation outside the loaded server page remains visible without changing its cursor", () => {
  const listed = conversation(601, 11),
    outsidePage = conversation(600, 10);
  const foreign = {
    ...conversation(602, 10),
    participantAId: fixtureId(8),
    participantBId: fixtureId(9),
  };
  const known = knownInboxConversations(
    [listed],
    [listed, outsidePage, foreign],
    new Set([outsidePage.id, foreign.id]),
    ownerId,
  );
  const rows = conversationInbox(
    known,
    new Map(),
    [queued(outsidePage.id, 800, 14)],
    ownerId,
  );
  assert.deepEqual(
    rows.map((row) => row.conversation.id),
    [outsidePage.id, listed.id],
  );
  assert.equal(
    knownInboxConversations([listed], [outsidePage], new Set(), ownerId).length,
    1,
  );
});

test("sending immediately updates preview and promotes an older conversation before ACK", () => {
  const old = conversation(600, 10),
    newer = conversation(601, 11);
  const confirmed = new Map([[newer.id, message(newer.id, 12)]]);
  const rows = conversationInbox(
    [newer, old],
    confirmed,
    [queued(old.id, 800, 13), queued(old.id, 801, 14)],
    ownerId,
  );
  assert.equal(rows[0]!.conversation.id, old.id);
  assert.equal(rows[0]!.preview, "Bạn: Tin 801");
  assert.equal(rows[0]!.state, "pending");
  assert.equal(rows[0]!.activityAt, at(14));
});
test("empty conversations still show pending text and failed text stays visible for retry", () => {
  const c = conversation(600, 10),
    pending = queued(c.id, 800, 13);
  assert.equal(
    conversationInbox([c], new Map(), [pending], ownerId)[0]!.state,
    "pending",
  );
  assert.equal(
    conversationInbox(
      [c],
      new Map(),
      [{ ...pending, state: "failed" }],
      ownerId,
    )[0]!.state,
    "failed",
  );
  assert.equal(
    conversationInbox([c], new Map(), [], ownerId)[0]!.preview,
    "Bắt đầu trò chuyện",
  );
});
test("delayed ACKs cannot overwrite newer incoming messages, and account caches stay separate", () => {
  const cache = new QueryClient();
  const c = conversation(600, 10),
    old = message(c.id, 12, "9007199254740993"),
    latest = {
      ...message(c.id, 13, "9007199254740994"),
      senderId: fixtureId(2),
    };
  const base = ["connections", ownerId, 1];
  rememberLatestMessage(cache, base, latest);
  rememberLatestMessage(cache, base, old);
  assert.equal(
    cache.getQueryData<ApiMessage>([...base, "conversation-preview", c.id])!
      .sequence,
    latest.sequence,
  );
  assert.equal(
    cache.getQueryData([
      "connections",
      fixtureId(3),
      1,
      "conversation-preview",
      c.id,
    ]),
    undefined,
  );
  assert.equal(newestMessage(old, latest, old)?.sequence, latest.sequence);
  cache.clear();
});
test("receipts replace pending previews without duplication; later incoming text wins", () => {
  const c = conversation(600, 10),
    ack = message(c.id, 13),
    pending = {
      ...queued(c.id, 800, 13),
      messageId: ack.id,
      state: "processing" as const,
    };
  const result = conversationInbox(
    [c],
    new Map([[c.id, ack]]),
    [pending],
    ownerId,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0]!.preview, "Bạn: Nội dung mới");
  assert.equal(result[0]!.state, undefined);
  const incoming = { ...message(c.id, 15, "2"), senderId: fixtureId(2) };
  assert.equal(
    conversationInbox(
      [c],
      new Map([[c.id, incoming]]),
      [queued(c.id, 801, 14)],
      ownerId,
    )[0]!.preview,
    "Nội dung mới",
  );
});
test("file-only previews are readable and input conversation pages are not mutated", () => {
  const c = conversation(600, 10),
    second = conversation(601, 11),
    input = [c, second];
  const file = {
    ...message(c.id, 14),
    messageType: "FILE" as const,
    messageText: "",
  };
  const rows = conversationInbox(input, new Map([[c.id, file]]), [], ownerId);
  assert.equal(rows[0]!.preview, "Bạn: Đã gửi một tệp");
  assert.deepEqual(
    input.map((c) => c.id),
    [c.id, second.id],
  );
});
test("latest-message reads request one item through the existing history endpoint", async () => {
  let path = "";
  const c = conversation(600, 10);
  const api = createMessagesApi(async (url) => {
    path = url;
    return {
      data: [message(c.id, 12)],
      meta: { pagination: { limit: 1, hasMore: true, nextCursor: "older" } },
    };
  }, ownerId);
  const page = await api.history(c.id, { limit: 1 });
  assert.equal(path, `/conversations/${c.id}/messages?limit=1`);
  assert.equal(page.nextCursor, "older");
});
