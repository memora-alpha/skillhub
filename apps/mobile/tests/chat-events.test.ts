import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { AppError } from "../src/lib/http/errors";
import {
  createChatEventHydrator,
  reloadChatEventQueries,
} from "../src/features/messages/utils/event-hydration";
import type { SseFrame } from "../src/features/messages/utils/sse-parser";

const id = (n: number) =>
  `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const frame = (
  event = "chat.message.created",
  data: unknown = {
    conversationId: id(1),
    messageId: id(2),
    messageSequence: "9007199254740993",
  },
): SseFrame => ({
  event,
  id: "opaque-1",
  data: JSON.stringify({ eventId: id(3), version: 1, data }),
});
function setup(
  reload?: (
    keys: readonly unknown[][],
    receiptsFor?: string,
  ) => Promise<unknown>,
) {
  const calls: unknown[][][] = [];
  let current = true,
    ready = 0,
    renew = 0;
  const hydrator = createChatEventHydrator({
    reload: async (keys, receiptsFor) => {
      calls.push(keys.map((key) => [...key]));
      return reload?.(
        keys.map((key) => [...key]),
        receiptsFor,
      );
    },
    assertCurrent: () => {
      if (!current) throw new AppError("session");
    },
    renew: async () => {
      renew++;
    },
    ready: () => {
      ready++;
    },
  });
  return {
    hydrator,
    calls,
    signal: new AbortController().signal,
    expire: () => {
      current = false;
    },
    ready: () => ready,
    renew: () => renew,
  };
}

test("message, delivery and read events reload only their conversation and relevant lists", async () => {
  const s = setup();
  await s.hydrator.handle(frame(), s.signal);
  assert.deepEqual(s.calls[0], [
    ["thread", id(1)],
    ["conversations"],
    ["conversation-preview", id(1)],
  ]);
  s.hydrator.reset();
  await s.hydrator.handle(frame("chat.delivery.updated"), s.signal);
  assert.deepEqual(s.calls[1], [
    ["thread", id(1)],
    ["conversations"],
    ["conversation-preview", id(1)],
    ["delivery", id(1)],
  ]);
  s.hydrator.reset();
  await s.hydrator.handle(
    frame("chat.read.updated", {
      conversationId: id(1),
      readerId: id(4),
      lastReadSequence: "9007199254740993",
    }),
    s.signal,
  );
  assert.deepEqual(s.calls[2], [["thread", id(1)]]);
});
test("proposal acceptance refreshes its detail, proposal lists and newly opened conversations", async () => {
  const s = setup();
  await s.hydrator.handle(
    frame("proposal.accepted", { proposalId: id(5) }),
    s.signal,
  );
  assert.deepEqual(s.calls[0], [
    ["proposals"],
    ["proposal", id(5)],
    ["conversations"],
  ]);
});
test("checkpoints acknowledge hidden rows without refetching or claiming a successful connection", async () => {
  const s = setup();
  await s.hydrator.handle(
    { event: "stream.checkpoint", id: "hidden-row", data: "{}" },
    s.signal,
  );
  assert.equal(s.hydrator.cursor, "hidden-row");
  assert.equal(s.calls.length, 0);
  assert.equal(s.ready(), 0);
});
test("failed hydration retains the old cursor and retries the event; a successful replay is deduplicated", async () => {
  let fail = true;
  const s = setup(async () => {
    if (fail) throw new AppError("network");
  });
  await s.hydrator.handle(
    { event: "stream.checkpoint", id: "before", data: "{}" },
    s.signal,
  );
  await assert.rejects(s.hydrator.handle(frame(), s.signal), AppError);
  assert.equal(s.hydrator.cursor, "before");
  fail = false;
  await s.hydrator.handle(frame(), s.signal);
  await s.hydrator.handle({ ...frame(), id: "replayed" }, s.signal);
  assert.equal(s.calls.length, 2);
  assert.equal(s.hydrator.cursor, "replayed");
});
test("invalid envelopes cannot advance the cursor; unrelated events are ignored", async () => {
  const s = setup();
  for (const data of [
    "not-json",
    JSON.stringify({ eventId: id(3), version: 2, data: {} }),
    JSON.stringify({
      eventId: id(3),
      version: 1,
      data: { conversationId: "wrong" },
    }),
  ]) {
    await assert.rejects(
      s.hydrator.handle({ ...frame(), data }, s.signal),
      AppError,
    );
    assert.equal(s.hydrator.cursor, undefined);
  }
  await s.hydrator.handle(
    { event: "unrelated.domain.updated", id: "other-domain", data: "{}" },
    s.signal,
  );
  assert.equal(s.calls.length, 0);
  assert.equal(s.hydrator.cursor, "other-domain");
});
test("reset, reauthentication, cancellation and expired sessions preserve stream boundaries", async () => {
  const s = setup();
  await s.hydrator.handle(frame(), s.signal);
  await assert.rejects(
    s.hydrator.handle({ event: "stream.reset-required", data: "{}" }, s.signal),
    AppError,
  );
  assert.equal(s.hydrator.cursor, undefined);
  await s.hydrator.handle(frame(), s.signal);
  assert.equal(s.calls.length, 2);
  await assert.rejects(
    s.hydrator.handle(
      { event: "stream.reauth-required", data: "{}" },
      s.signal,
    ),
    AppError,
  );
  assert.equal(s.renew(), 1);
  const cancelled = new AbortController();
  cancelled.abort();
  await s.hydrator.handle({ ...frame(), id: "cancelled" }, cancelled.signal);
  assert.equal(s.hydrator.cursor, "opaque-1");
  s.expire();
  await assert.rejects(
    s.hydrator.handle({ ...frame(), id: "old-session" }, s.signal),
    AppError,
  );
  assert.equal(s.hydrator.cursor, "opaque-1");
});
test("late hydration cannot acknowledge a cursor after abort or account switch", async () => {
  let finish!: () => void;
  const s = setup(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const controller = new AbortController();
  const pending = s.hydrator.handle(frame(), controller.signal);
  controller.abort();
  finish();
  await pending;
  assert.equal(s.hydrator.cursor, undefined);
  const late = s.hydrator.handle(frame(), s.signal);
  s.expire();
  finish();
  await assert.rejects(late, AppError);
  assert.equal(s.hydrator.cursor, undefined);
});
test("ready hydration with real Query observers excludes unrelated paths and other accounts", async () => {
  const cache = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    },
  });
  const base = ["connections", id(1), 1];
  const calls = { chat: 0, path: 0, otherAccount: 0 };
  const entries = [
    {
      queryKey: [...base, "thread", id(2)],
      queryFn: async () => {
        calls.chat++;
        return [];
      },
    },
    {
      queryKey: [...base, "learning-paths", id(5)],
      queryFn: async () => {
        calls.path++;
        throw new AppError("http", 503);
      },
    },
    {
      queryKey: ["connections", id(4), 1, "thread", id(2)],
      queryFn: async () => {
        calls.otherAccount++;
        return [];
      },
    },
  ];
  const dispose = entries.map((entry) => {
    cache.setQueryData(entry.queryKey, []);
    return new QueryObserver(cache, entry).subscribe(() => {});
  });
  const s = setup((keys) => reloadChatEventQueries(cache, base, keys));
  try {
    await s.hydrator.handle(
      { event: "stream.ready", id: "head", data: "{}" },
      s.signal,
    );
    assert.deepEqual(calls, { chat: 1, path: 0, otherAccount: 0 });
    assert.equal(s.ready(), 1);
    assert.equal(s.hydrator.cursor, "head");
  } finally {
    dispose.forEach((fn) => fn());
    cache.clear();
  }
});
test("read events mark only the matching account/thread for a timestamp refresh", async () => {
  const cache = new QueryClient();
  const base = ["connections", id(1), 1];
  const s = setup((keys, receiptsFor) =>
    reloadChatEventQueries(cache, base, keys, receiptsFor),
  );
  try {
    const event = frame("chat.read.updated", {
      conversationId: id(2),
      readerId: id(4),
      lastReadSequence: "42",
    });
    await s.hydrator.handle(event, s.signal);
    await s.hydrator.handle(event, s.signal);
    assert.equal(cache.getQueryData([...base, "thread-receipts", id(2)]), 1);
    assert.equal(
      cache.getQueryData([...base, "thread-receipts", id(3)]),
      undefined,
    );
    assert.equal(
      cache.getQueryData(["connections", id(4), 1, "thread-receipts", id(2)]),
      undefined,
    );
  } finally {
    cache.clear();
  }
});
