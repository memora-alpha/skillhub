import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import type { ApiMessage } from "../src/features/messages/api/messages-api";
import { rememberDeliveredMessage } from "../src/features/messages/utils/conversation-preview";
import type { ThreadSnapshot } from "../src/features/messages/utils/thread-snapshot";
import { fixtureId } from "./fixtures/learning-requests-data";

const base = ["owner", "delivery-cache"];
const message: ApiMessage = {
  id: fixtureId(1),
  conversationId: fixtureId(2),
  senderId: fixtureId(3),
  sequence: "1",
  messageType: "FILE",
  messageText: "",
  readAt: null,
  sentAt: "2026-11-25T00:00:00Z",
  attachments: [
    {
      attachmentId: fixtureId(4),
      fileId: fixtureId(5),
      filename: "fixture.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 100,
      downloadUrlEndpoint: "/fixture",
      availability: "AVAILABLE",
    },
  ],
};

test("a late delivery receipt cannot reopen a revoked file or erase newer read receipts in thread and previews", () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  try {
    const fresh: ApiMessage = {
      ...message,
      readAt: "2026-11-25T00:01:00Z",
      attachments: [{ ...message.attachments[0]!, availability: "REVOKED" }],
    };
    const threadKey = [...base, "thread", message.conversationId];
    const previewKey = [
      ...base,
      "conversations",
      "preview",
      message.conversationId,
    ];
    const rememberedKey = [
      ...base,
      "conversation-preview",
      message.conversationId,
    ];
    const snapshot: ThreadSnapshot = {
      messages: [fresh],
      nextCursor: "older",
      attachmentRevision: 7,
      receiptRevision: 8,
    };
    cache.setQueryData(threadKey, snapshot);
    cache.setQueryData(previewKey, { message: fresh, unread: false });
    cache.setQueryData(rememberedKey, fresh);
    rememberDeliveredMessage(cache, base, message);
    assert.deepEqual(cache.getQueryData(threadKey), snapshot);
    assert.deepEqual(cache.getQueryData(previewKey), {
      message: fresh,
      unread: false,
    });
    assert.deepEqual(cache.getQueryData(rememberedKey), fresh);
  } finally {
    cache.clear();
  }
});

test("delivery cache inserts new messages, keeps newer preview activity and never seeds a partial history", () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  try {
    const threadKey = [...base, "thread", message.conversationId];
    const previewKey = [
      ...base,
      "conversations",
      "preview",
      message.conversationId,
    ];
    const rememberedKey = [
      ...base,
      "conversation-preview",
      message.conversationId,
    ];
    rememberDeliveredMessage(cache, base, message);
    assert.equal(cache.getQueryData(threadKey), undefined);
    assert.equal(cache.getQueryData(previewKey), undefined);
    assert.deepEqual(cache.getQueryData(rememberedKey), message);
    cache.setQueryData(threadKey, {
      messages: [message],
      nextCursor: "older",
      attachmentRevision: 7,
    });
    cache.setQueryData(previewKey, { message, unread: true });
    const next = { ...message, id: fixtureId(6), sequence: "2" };
    rememberDeliveredMessage(cache, base, next);
    rememberDeliveredMessage(cache, base, message);
    assert.deepEqual(cache.getQueryData(threadKey), {
      messages: [message, next],
      nextCursor: "older",
      attachmentRevision: 7,
    });
    assert.deepEqual(cache.getQueryData(previewKey), {
      message: next,
      unread: true,
    });
    assert.deepEqual(cache.getQueryData(rememberedKey), next);
  } finally {
    cache.clear();
  }
});
