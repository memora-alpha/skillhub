import assert from "node:assert/strict";
import test from "node:test";
import {
  readThreadSnapshot,
  type ThreadSnapshot,
} from "../src/features/messages/utils/thread-snapshot";
import type { ApiMessage } from "../src/features/messages/api/messages-api";
import { fixtureId } from "./fixtures/learning-requests-data";
const message = (n: number): ApiMessage => ({
  id: fixtureId(100 + n),
  conversationId: fixtureId(40),
  senderId: fixtureId(1),
  messageText: `Tin ${n}`,
  messageType: "TEXT",
  attachments: [],
  sequence: String(n),
  sentAt: "2030-01-01T00:00:00Z",
  readAt: null,
});
const page = (numbers: number[], nextCursor: string | null = null) => ({
  limit: 20,
  items: numbers.map(message),
  hasMore: !!nextCursor,
  nextCursor,
});
const options = (previous?: ThreadSnapshot) => ({
  signal: new AbortController().signal,
  latestOnly: false,
  previous,
  receiptRevision: 0,
  current: () => previous,
  assertCurrent: () => {},
});
test("entering chat reads only newest page despite a large cached offline gap", async () => {
  const calls: unknown[] = [];
  const result = await readThreadSnapshot(
    {
      history: async (_, opts) => {
        calls.push(opts);
        return page([99, 100], "older-99");
      },
    },
    fixtureId(40),
    {
      ...options({ messages: [message(1)], nextCursor: null }),
      latestOnly: true,
    },
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(
    result.messages.map((v) => v.sequence),
    ["99", "100"],
  );
  assert.equal(result.nextCursor, "older-99");
});
test("background gap fill keeps concurrently loaded older history/cursor", async () => {
  const previous = { messages: [message(3)], nextCursor: "older-3" };
  let current: ThreadSnapshot = previous;
  const result = await readThreadSnapshot(
    {
      history: async (_, opts) => {
        if (!opts?.afterSequence) return page([7, 8], "older-7");
        if (opts.afterSequence === "3") {
          current = {
            messages: [message(1), message(2), message(3)],
            nextCursor: null,
          };
          return page([4, 5], "next");
        }
        return page([6, 7, 8]);
      },
    },
    fixtureId(40),
    { ...options(previous), current: () => current },
  );
  assert.deepEqual(
    result.messages.map((v) => v.sequence),
    ["1", "2", "3", "4", "5", "6", "7", "8"],
  );
  assert.equal(result.nextCursor, null);
});
test("gap pagination without forward progress fails instead of looping", async () => {
  await assert.rejects(
    readThreadSnapshot(
      {
        history: async (_, opts) =>
          opts?.afterSequence ? page([3], "same") : page([10]),
      },
      fixtureId(40),
      options({ messages: [message(3)], nextCursor: null }),
    ),
    /protocol/,
  );
});
test("expired session cannot return the newly fetched tail", async () => {
  await assert.rejects(
    readThreadSnapshot({ history: async () => page([10]) }, fixtureId(40), {
      ...options(),
      assertCurrent: () => {
        throw Error("session expired");
      },
    }),
    /session expired/,
  );
});
