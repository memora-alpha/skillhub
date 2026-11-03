import assert from "node:assert/strict";
import test from "node:test";
import { conversationInbox } from "../src/features/messages/utils/conversation-preview";
import type { ApiMessage } from "../src/features/messages/api/messages-api";
import type { QueuedText } from "../src/features/messages/outbox/outbox-types";
import { fixtureId } from "./fixtures/learning-requests-data";

test("interleaved outbox entries preserve per-conversation draft order, failed state and delivered preview", () => {
  const conversations = [1, 2, 3].map((n) => ({
    id: fixtureId(n),
    proposalId: fixtureId(n + 10),
    learningRequestId: null,
    participantAId: "me",
    participantBId: "peer",
    createdAt: "2030-01-01T00:00:00Z",
  }));
  const sent: ApiMessage = {
    id: fixtureId(50),
    conversationId: fixtureId(2),
    senderId: "me",
    sequence: "10",
    messageText: "Delivered",
    messageType: "TEXT",
    attachments: [],
    readAt: null,
    sentAt: "2030-01-04T00:00:00Z",
  };
  const queued = (
    id: number,
    conversation: number,
    state: QueuedText["state"],
    text: string,
  ): QueuedText => ({
    clientMessageId: fixtureId(id),
    conversationId: fixtureId(conversation),
    state,
    phase: "send",
    messageText: text,
    createdAt: "2030-01-05T00:00:00Z",
    attempts: 0,
    retryAt: 0,
  });
  const outbox = [
    queued(20, 1, "queued", "First draft"),
    {
      ...queued(21, 2, "sent", "Delivered"),
      message: sent,
      messageId: sent.id,
    },
    queued(22, 1, "failed", "Last draft"),
  ];
  const before = JSON.stringify(outbox);
  const rows = conversationInbox(conversations, new Map(), outbox, "me");
  assert.deepEqual(
    rows.map((row) => ({
      id: row.conversation.id,
      preview: row.preview,
      state: row.state,
    })),
    [
      { id: fixtureId(1), preview: "Bạn: Last draft", state: "failed" },
      { id: fixtureId(2), preview: "Bạn: Delivered", state: undefined },
      { id: fixtureId(3), preview: "Bắt đầu trò chuyện", state: undefined },
    ],
  );
  assert.equal(JSON.stringify(outbox), before);
});

test("preview sender is the actual message author and system messages are never attributed to the partner", () => {
  const conversation = {
    id: fixtureId(1),
    proposalId: fixtureId(11),
    learningRequestId: fixtureId(21),
    participantAId: "me",
    participantBId: "peer",
    createdAt: "2030-01-01T00:00:00Z",
  };
  const message: ApiMessage = {
    id: fixtureId(50),
    conversationId: conversation.id,
    senderId: "peer",
    sequence: "10",
    messageText: "Latest incoming",
    messageType: "TEXT",
    attachments: [],
    readAt: null,
    sentAt: "2030-01-04T00:00:00Z",
  };
  const rows = (item: ApiMessage) =>
    conversationInbox(
      [conversation],
      new Map([[conversation.id, item]]),
      [],
      "me",
    );
  assert.equal(rows(message)[0]?.previewSenderId, "peer");
  assert.equal(
    rows({ ...message, senderId: "me" })[0]?.preview,
    "Bạn: Latest incoming",
  );
  assert.equal(rows({ ...message, senderId: "me" })[0]?.previewSenderId, "me");
  assert.equal(
    rows({ ...message, messageType: "SYSTEM" })[0]?.previewSenderId,
    undefined,
  );
});
