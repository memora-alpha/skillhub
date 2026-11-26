import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError, errorMessage } from "../src/lib/http/errors";
import { TextOutbox } from "../src/features/messages/outbox/text-outbox";
import type {
  ApiMessage,
  MessageDraft,
} from "../src/features/messages/api/messages-api";
import { fixtureId } from "./fixtures/learning-requests-data";

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function harness() {
  let saved: string | null = null;
  let nextId = 80;
  let failure: unknown = new AppError(
    "http",
    422,
    "CONTENT_MODERATION_BLOCKED",
  );
  let current = true;
  const sent: MessageDraft[] = [];
  const checked: string[] = [];
  const confirmed: ApiMessage[] = [];
  const message: ApiMessage = {
    id: fixtureId(50),
    conversationId: fixtureId(40),
    senderId: fixtureId(1),
    messageText: "Đã sửa",
    messageType: "TEXT",
    attachments: [],
    sequence: "1",
    sentAt: "2026-11-21T00:00:00Z",
    readAt: null,
  };
  const options = {
    ownerId: fixtureId(1),
    scope: "https://fixture.test",
    current: () => current,
    createId: () => fixtureId(nextId++),
    storage: {
      read: async () => saved,
      write: async (raw: string) => {
        saved = raw;
      },
    },
    api: {
      send: async (_conversation: string, body: MessageDraft) => {
        sent.push(body);
        if (failure) throw failure;
        return { deliveryStatus: "DELIVERED" as const, message };
      },
      delivery: async (_conversation: string, id: string) => {
        checked.push(id);
        if (failure) throw failure;
        return {
          deliveryStatus: "PREPARING" as const,
          messageId: fixtureId(50),
          clientMessageId: id,
          statusUrl: "/delivery",
          failureCode: null,
        };
      },
    },
    delivered(message: ApiMessage) {
      confirmed.push(message);
    },
  };
  return {
    options,
    sent,
    checked,
    confirmed,
    saved: () => saved,
    fail: (value: unknown) => {
      failure = value;
    },
    expire: () => {
      current = false;
    },
  };
}

test("moderation and contact errors explain rejection and temporary failures separately", () => {
  assert.match(
    errorMessage(new AppError("http", 422, "CONTENT_MODERATION_BLOCKED")),
    /không thể gửi.*nội dung/i,
  );
  assert.match(
    errorMessage(new AppError("http", 400, "CONTACT_INFORMATION_NOT_ALLOWED")),
    /số điện thoại.*email/i,
  );
  assert.match(
    errorMessage(
      new AppError("http", 503, "CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE"),
    ),
    /tạm thời/i,
  );
});

test("blocked text keeps its code across restart and cannot retry the rejected identity", async () => {
  const h = harness();
  const first = new TextOutbox(h.options);
  const restored = new TextOutbox(h.options);
  try {
    await first.start();
    first.enqueue(fixtureId(40), "Nội dung bị chặn");
    await flush();
    const entry = first.getSnapshot().items[0]!;
    assert.equal(entry.state, "failed");
    assert.equal(entry.failureCode, "CONTENT_MODERATION_BLOCKED");
    assert.deepEqual(
      h.confirmed,
      [],
      "blocked text never updates published history",
    );
    first.retry(entry.clientMessageId);
    await flush();
    assert.equal(h.sent.length, 1);
    assert.equal(h.checked.length, 0);
    first.stop();
    await restored.start();
    assert.equal(
      restored.getSnapshot().items[0]!.failureCode,
      entry.failureCode,
    );
    assert.equal(restored.getSnapshot().items[0]!.state, "failed");
    restored.retry(entry.clientMessageId);
    await flush();
    assert.equal(h.checked.length, 0);
    assert.deepEqual(
      h.confirmed,
      [],
      "restoring a failure cannot publish it for the receiver",
    );
    h.fail(undefined);
    assert.equal(restored.enqueue(fixtureId(40), "Tin mới"), true);
    await flush();
    assert.equal(h.sent.length, 2);
    assert.equal(
      h.confirmed.length,
      1,
      "only the new accepted message is published",
    );
    assert.notEqual(h.sent[1]!.clientMessageId, entry.clientMessageId);
    assert.equal(
      restored.getSnapshot().items[0]!.clientMessageId,
      entry.clientMessageId,
    );
    assert.equal(restored.getSnapshot().items[0]!.state, "failed");
  } finally {
    first.stop();
    restored.stop();
  }
});

test("temporary moderation outage retries the immutable command after its delay", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = harness();
  let now = 1000;
  h.fail(
    new AppError("http", 503, "CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE"),
  );
  const store = new TextOutbox({ ...h.options, now: () => now });
  try {
    await store.start();
    store.enqueue(fixtureId(40), "original");
    await flush();
    const entry = store.getSnapshot().items[0]!;
    assert.equal(entry.state, "queued");
    assert.equal(
      entry.failureCode,
      "CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE",
    );
    h.fail(undefined);
    now = entry.retryAt;
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(h.sent.length, 2);
    assert.deepEqual(h.sent[1], h.sent[0]);
    assert.equal(store.getSnapshot().items[0]!.state, "sent");
    assert.equal(store.getSnapshot().items[0]!.failureCode, undefined);
  } finally {
    store.stop();
  }
});

test("expired owner cannot retry or enqueue messages", async () => {
  const h = harness();
  const store = new TextOutbox(h.options);
  try {
    await store.start();
    store.enqueue(fixtureId(40), "blocked");
    await flush();
    const id = store.getSnapshot().items[0]!.clientMessageId;
    h.expire();
    store.retry(id);
    assert.equal(store.enqueue(fixtureId(40), "new text"), false);
    assert.equal(h.sent.length, 1);
    assert.equal(store.getSnapshot().items.length, 1);
  } finally {
    store.stop();
  }
});
