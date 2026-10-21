import assert from "node:assert/strict";
import test from "node:test";
import { lastSeenOutgoingId } from "../src/features/messages/utils/seen-message";
import type { ApiMessage } from "../src/features/messages/api/messages-api";
import { fixtureId } from "./fixtures/learning-requests-data";
const me = fixtureId(1),
  peer = fixtureId(2);
const message = (n: number, senderId = me, read = true): ApiMessage => ({
  id: fixtureId(100 + n),
  conversationId: fixtureId(40),
  senderId,
  messageText: "Chat",
  messageType: "TEXT",
  attachments: [],
  sequence: String(n),
  sentAt: "2030-01-01T00:00:00Z",
  readAt: read ? "2030-01-01T00:01:00Z" : null,
});
test("many read outgoing messages produce only one receipt at the furthest sequence", () => {
  const messages = [message(1), message(3), message(2)];
  const seen = lastSeenOutgoingId(messages, me);
  assert.equal(seen, message(3).id);
  assert.equal(messages.filter((item) => item.id === seen).length, 1);
  assert.equal(lastSeenOutgoingId([...messages].reverse(), me), seen);
});
test("new unread or incoming messages leave the receipt on the last read outgoing message", () => {
  assert.equal(
    lastSeenOutgoingId(
      [message(1), message(2, me, false), message(3, peer)],
      me,
    ),
    message(1).id,
  );
  assert.equal(
    lastSeenOutgoingId([message(1, me, false), message(2, peer)], me),
    undefined,
  );
});
test("no viewer or server system message cannot create a peer receipt", () => {
  assert.equal(lastSeenOutgoingId([message(1)], undefined), undefined);
  assert.equal(
    lastSeenOutgoingId([{ ...message(1), messageType: "SYSTEM" }], me),
    undefined,
  );
});
