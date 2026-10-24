import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import {
  hydrateWithRateLimit,
  waitForRetry,
} from "../src/features/messages/utils/rate-limited-event";
import { createChatEventHydrator } from "../src/features/messages/utils/event-hydration";
import { TextOutbox } from "../src/features/messages/outbox/text-outbox";
import { fixtureId } from "./fixtures/learning-requests-data";
import type { ApiMessage } from "../src/features/messages/api/messages-api";

test("429 hydration retries the same frame without acknowledging its cursor early", async () => {
  let reads = 0,
    pauses = 0,
    ready = 0;
  const hydration = createChatEventHydrator({
    reload: async () => {
      if (++reads === 1)
        throw new AppError("http", 429, "RATE_LIMITED", Date.now() + 60000);
    },
    assertCurrent: () => {},
    renew: async () => {},
    ready: () => {
      ready++;
    },
  });
  const frame = { event: "stream.ready", data: "{}", id: "cursor-1" };
  await hydrateWithRateLimit(
    () => hydration.handle(frame, new AbortController().signal),
    new AbortController().signal,
    async (delay) => {
      pauses++;
      assert.ok(delay > 0);
      assert.equal(hydration.cursor, undefined);
    },
  );
  assert.equal(reads, 2);
  assert.equal(pauses, 1);
  assert.equal(ready, 1);
  assert.equal(hydration.cursor, "cursor-1");
});

test("background/logout abort cancels a pending retry timer", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const control = new AbortController();
  const pending = waitForRetry(60000, control.signal);
  const rejected = assert.rejects(
    pending,
    (error) => error instanceof AppError && error.kind === "session",
  );
  control.abort();
  await rejected;
});

test("repeated hydration limits stay sequential and stop when canceled after a pause", async () => {
  const control = new AbortController();
  let reads = 0,
    pauses = 0,
    active = 0;
  await hydrateWithRateLimit(
    async () => {
      assert.equal(active++, 0);
      reads++;
      await Promise.resolve();
      active--;
      throw new AppError("http", 429, "RATE_LIMITED", Date.now() + 60000);
    },
    control.signal,
    async () => {
      assert.equal(active, 0);
      if (++pauses === 3) control.abort();
    },
  );
  assert.equal(reads, 3);
  assert.equal(pauses, 3);
});

test("hydration skips an aborted signal and does not retry non-429 errors", async () => {
  const control = new AbortController();
  control.abort();
  let reads = 0,
    pauses = 0;
  const pause = async () => {
    pauses++;
  };
  await hydrateWithRateLimit(
    async () => {
      reads++;
    },
    control.signal,
    pause,
  );
  assert.equal(reads, 0);
  const denied = new AppError("http", 403);
  await assert.rejects(
    hydrateWithRateLimit(
      async () => {
        reads++;
        throw denied;
      },
      new AbortController().signal,
      pause,
    ),
    (error) => error === denied,
  );
  assert.equal(reads, 1);
  assert.equal(pauses, 0);
});

test("outbox rate-limit deadline survives reconnect and restart without replaying a new message", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let now = 1000,
    saved: string | null = null,
    sends = 0,
    checks = 0,
    delivered = 0;
  const ids: string[] = [];
  const message: ApiMessage = {
    id: fixtureId(50),
    conversationId: fixtureId(40),
    senderId: fixtureId(1),
    messageText: "hello",
    messageType: "TEXT",
    attachments: [],
    sequence: "1",
    sentAt: "2026-10-23T10:00:00Z",
    readAt: null,
  };
  const options = {
    ownerId: fixtureId(1),
    scope: "https://fixture.test",
    current: () => true,
    now: () => now,
    createId: () => fixtureId(90),
    storage: {
      read: async () => saved,
      write: async (value: string) => {
        saved = value;
      },
    },
    api: {
      send: async (_id: string, body: { clientMessageId: string }) => {
        sends++;
        ids.push(body.clientMessageId);
        throw new AppError("http", 429, "CHAT_RATE_LIMIT", 61000);
      },
      delivery: async (_id: string, clientMessageId: string) => {
        checks++;
        ids.push(clientMessageId);
        return { deliveryStatus: "DELIVERED" as const, message };
      },
    },
    delivered: () => {
      delivered++;
    },
  };
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  const first = new TextOutbox(options);
  let second: TextOutbox | undefined;
  try {
    await first.start();
    assert.equal(first.enqueue(fixtureId(40), "hello"), true);
    await flush();
    assert.equal(sends, 1);
    assert.equal(first.getSnapshot().items[0]?.retryAt, 61000);
    first.setConnection(false);
    first.setConnection(true);
    await flush();
    assert.equal(sends, 1);
    assert.equal(checks, 0);
    first.stop();
    second = new TextOutbox(options);
    await second.start();
    await flush();
    assert.equal(checks, 0);
    now = 61000;
    t.mock.timers.tick(60000);
    await flush();
    assert.equal(sends, 1);
    assert.equal(checks, 1);
    assert.equal(delivered, 1);
    assert.deepEqual(ids, [fixtureId(90), fixtureId(90)]);
  } finally {
    first.stop();
    second?.stop();
  }
});
