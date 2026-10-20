import assert from "node:assert/strict";
import test from "node:test";
import {
  createMessagesApi,
  type ApiMessage,
} from "../src/features/messages/api/messages-api";
import { refreshLoadedReadReceipts } from "../src/features/messages/utils/read-receipts";
import { AppError } from "../src/lib/http/errors";

const id = (n: number) =>
  `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function message(n: number, readAt: string | null = null): ApiMessage {
  return {
    id: id(n),
    conversationId: id(10),
    senderId: id(20),
    messageText: "Tin nhắn",
    messageType: "TEXT",
    attachments: [],
    sequence: String(9007199254740993n + BigInt(n)),
    sentAt: "2026-10-16T10:00:00Z",
    readAt,
  };
}
const page = (items: ApiMessage[], cursor: string | null) => ({
  data: items,
  meta: {
    pagination: { limit: 20, hasMore: cursor !== null, nextCursor: cursor },
  },
});

test("read updates refresh actual timestamps in older loaded pages without losing messages", async () => {
  const timestamp = "2026-10-16T11:00:00Z";
  const original = [message(1), message(2), message(3)];
  const calls: string[] = [];
  const api = createMessagesApi(async (url) => {
    calls.push(url);
    return calls.length === 1
      ? page([message(3, timestamp)], "older")
      : page([message(1, timestamp), message(2, timestamp)], "beyond-loaded");
  }, id(20));
  const result = await refreshLoadedReadReceipts(
    api,
    id(10),
    original,
    id(20),
    new AbortController().signal,
  );
  assert.equal(calls.length, 2);
  assert.equal(
    new URL(calls[1]!, "http://fixture.test").searchParams.get("cursor"),
    "older",
  );
  assert.deepEqual(
    result.map((m) => m.readAt),
    [timestamp, timestamp, timestamp],
  );
  assert.deepEqual(
    result.map((m) => m.id),
    original.map((m) => m.id),
  );
  assert.equal(original[0]?.readAt, null);
});
test("fully read and incoming cached messages need no historical receipt reload", async () => {
  const api = createMessagesApi(async () => {
    assert.fail("must not fetch");
  }, id(20));
  const messages = [
    message(1, "2026-10-16T11:00:00Z"),
    { ...message(2), senderId: id(21) },
  ];
  assert.equal(
    await refreshLoadedReadReceipts(
      api,
      id(10),
      messages,
      id(20),
      new AbortController().signal,
    ),
    messages,
  );
});
test("receipt pagination rejects repeated cursors and propagates errors without changing the cache snapshot", async () => {
  const messages = [message(1)];
  const repeated = createMessagesApi(
    async () => page([message(3)], "same"),
    id(20),
  );
  await assert.rejects(
    refreshLoadedReadReceipts(
      repeated,
      id(10),
      messages,
      id(20),
      new AbortController().signal,
    ),
    AppError,
  );
  const failed = createMessagesApi(async () => {
    throw new AppError("network");
  }, id(20));
  await assert.rejects(
    refreshLoadedReadReceipts(
      failed,
      id(10),
      messages,
      id(20),
      new AbortController().signal,
    ),
    AppError,
  );
  assert.equal(messages[0]?.readAt, null);
});
test("cancelled receipt refresh never starts another history request", async () => {
  const controller = new AbortController();
  const api = createMessagesApi(async () => {
    assert.fail("must not fetch");
  }, id(20));
  controller.abort();
  await assert.rejects(
    refreshLoadedReadReceipts(
      api,
      id(10),
      [message(1)],
      id(20),
      controller.signal,
    ),
    AppError,
  );
});
