import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { AppError } from "../src/lib/http/errors";
import {
  readMessageTail,
  shareMessageTail,
} from "../src/features/messages/utils/message-tail";
import { readThreadSnapshot } from "../src/features/messages/utils/thread-snapshot";
import { reloadChatEventQueries } from "../src/features/messages/utils/event-hydration";

const base = ["connections", "owner", 1];
const page = { items: [], hasMore: false, nextCursor: null, limit: 20 };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("preview and thread share a tail in flight; later reads and other sessions fetch anew", async () => {
  const cache = new QueryClient(),
    pending = deferred<typeof page>();
  let calls = 0;
  const api = {
    history: async () => {
      calls++;
      return pending.promise;
    },
  };
  const control = new AbortController();
  try {
    const preview = readMessageTail(cache, base, api, "chat", control.signal);
    const thread = readThreadSnapshot(
      {
        history: (id, opts) =>
          readMessageTail(cache, base, api, id, opts?.signal),
      },
      "chat",
      {
        signal: control.signal,
        latestOnly: true,
        receiptRevision: 0,
        current: () => undefined,
        assertCurrent: () => {},
      },
    );
    assert.equal(calls, 1);
    pending.resolve(page);
    assert.deepEqual(await preview, page);
    assert.deepEqual((await thread).messages, []);
    await readMessageTail(cache, base, api, "chat");
    await readMessageTail(cache, ["connections", "owner", 2], api, "chat");
    assert.equal(calls, 3);
  } finally {
    cache.clear();
  }
});

test("aborting one consumer preserves the other's shared read; logout cancels transport", async () => {
  const cache = new QueryClient(),
    pending = deferred<typeof page>();
  const first = new AbortController();
  let transport: AbortSignal | undefined;
  const api = {
    history: async (_id: string, opts?: { signal?: AbortSignal }) => {
      transport = opts?.signal;
      return pending.promise;
    },
  };
  try {
    const cancelled = readMessageTail(cache, base, api, "chat", first.signal);
    const rejected = assert.rejects(
      cancelled,
      (e) => e instanceof AppError && e.kind === "session",
    );
    const remaining = readMessageTail(cache, base, api, "chat");
    first.abort();
    assert.equal(transport?.aborted, false);
    pending.resolve(page);
    await rejected;
    assert.deepEqual(await remaining, page);
    // A new transport remains pending until the session owner cancels its scope.
    const waiting = deferred<typeof page>();
    const logoutRead = readMessageTail(
      cache,
      base,
      {
        history: async (_id, opts) => {
          transport = opts?.signal;
          return waiting.promise;
        },
      },
      "chat",
    );
    const logoutRejected = assert.rejects(logoutRead);
    await cache.cancelQueries({ queryKey: base });
    assert.equal(transport?.aborted, true);
    await logoutRejected;
    waiting.resolve(page);
  } finally {
    cache.clear();
  }
});

test("the last aborted consumer cancels shared transport and a new consumer starts a new read", async () => {
  const cache = new QueryClient(),
    pending = deferred<typeof page>();
  const first = new AbortController(),
    second = new AbortController();
  let calls = 0,
    transport: AbortSignal | undefined;
  const api = {
    history: async (_id: string, opts?: { signal?: AbortSignal }) => {
      calls++;
      transport = opts?.signal;
      return pending.promise;
    },
  };
  try {
    const a = assert.rejects(
      readMessageTail(cache, base, api, "chat", first.signal),
    );
    const b = assert.rejects(
      readMessageTail(cache, base, api, "chat", second.signal),
    );
    first.abort();
    assert.equal(transport?.aborted, false);
    second.abort();
    assert.equal(transport?.aborted, true);
    await Promise.all([a, b]);
    const next = readMessageTail(cache, base, api, "chat");
    assert.equal(calls, 2);
    pending.resolve(page);
    assert.deepEqual(await next, page);
  } finally {
    cache.clear();
  }
});

test("an SSE event replaces a pre-event tail and its two consumers share the replacement", async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const old = deferred<typeof page>();
  let calls = 0;
  const api = { history: async () => (++calls === 1 ? old.promise : page) };
  const keys = [
    [...base, "thread", "chat"],
    [...base, "conversations", "preview", "chat"],
  ];
  const stops = keys.map((queryKey) => {
    cache.setQueryData(queryKey, page);
    return new QueryObserver(cache, {
      queryKey,
      queryFn: ({ signal }) =>
        readMessageTail(cache, base, api, "chat", signal),
    }).subscribe(() => {});
  });
  try {
    const before = cache.refetchQueries(
      { queryKey: base },
      { cancelRefetch: false },
    );
    assert.equal(calls, 1);
    await reloadChatEventQueries(cache, base, [
      ["thread", "chat"],
      ["conversations", "preview", "chat"],
    ]);
    assert.equal(calls, 2);
    old.resolve({ ...page, limit: 10 });
    await before;
    for (const key of keys) assert.deepEqual(cache.getQueryData(key), page);
  } finally {
    stops.forEach((stop) => stop());
    cache.clear();
  }
});

test("an event during the first Inbox/Chat load finishes hydration without a failed reconnect", async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const old = deferred<typeof page>();
  let calls = 0;
  const api = { history: async () => (++calls === 1 ? old.promise : page) };
  const keys = [
    [...base, "thread", "chat"],
    [...base, "conversations", "preview", "chat"],
  ];
  const stops = keys.map((queryKey) =>
    new QueryObserver(cache, {
      queryKey,
      queryFn: ({ signal }) =>
        readMessageTail(cache, base, api, "chat", signal),
    }).subscribe(() => {}),
  );
  try {
    assert.equal(calls, 1);
    await reloadChatEventQueries(cache, base, [
      ["thread", "chat"],
      ["conversations", "preview", "chat"],
    ]);
    assert.equal(calls, 2);
    for (const key of keys) {
      assert.equal(cache.getQueryState(key)?.status, "success");
      assert.deepEqual(cache.getQueryData(key), page);
    }
    old.resolve(page);
  } finally {
    stops.forEach((stop) => stop());
    cache.clear();
  }
});

test("shared 403 does not fall back to a cached successful tail", async () => {
  const cache = new QueryClient();
  try {
    await readMessageTail(cache, base, { history: async () => page }, "chat");
    const denied = new AppError("http", 403);
    let calls = 0;
    const api = {
      history: async () => {
        calls++;
        throw denied;
      },
    };
    const reads = await Promise.allSettled([
      readMessageTail(cache, base, api, "chat"),
      readMessageTail(cache, base, api, "chat"),
    ]);
    assert.equal(calls, 1);
    for (const result of reads) {
      assert.equal(result.status, "rejected");
      if (result.status === "rejected") assert.equal(result.reason, denied);
    }
  } finally {
    cache.clear();
  }
});

test("API shares only default tails; pagination, gap reads and explicit limits stay independent", async () => {
  const cache = new QueryClient(),
    pending = deferred<typeof page>();
  const calls: unknown[] = [];
  const api = shareMessageTail(cache, base, {
    history: async (
      _id: string,
      opts?: { cursor?: string; afterSequence?: string; limit?: number },
    ) => {
      calls.push(opts);
      return pending.promise;
    },
  });
  try {
    const reads = [
      api.history("chat"),
      api.history("chat"),
      api.history("chat", { cursor: "older" }),
      api.history("chat", { afterSequence: "3" }),
      api.history("chat", { limit: 1 }),
      api.history("other-chat"),
    ];
    assert.equal(calls.length, 5);
    assert.deepEqual(calls.slice(1, 4), [
      { cursor: "older" },
      { afterSequence: "3" },
      { limit: 1 },
    ]);
    pending.resolve(page);
    await Promise.all(reads);
  } finally {
    cache.clear();
  }
});

test("session switch during event preparation cannot recreate old receipt state or start reads", async () => {
  const cache = new QueryClient();
  let current = true;
  const assertCurrent = () => {
    if (!current) throw new AppError("session");
  };
  try {
    const reload = reloadChatEventQueries(
      cache,
      base,
      [["thread", "chat"]],
      "chat",
      assertCurrent,
    );
    current = false;
    await assert.rejects(
      reload,
      (e) => e instanceof AppError && e.kind === "session",
    );
    assert.equal(
      cache.getQueryData([...base, "thread-receipts", "chat"]),
      undefined,
    );
  } finally {
    cache.clear();
  }
});
