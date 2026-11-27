import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";
import { delivered, deferred, flush } from "./fixtures/attachment-outbox";

function harness() {
  assert.equal(delivered.deliveryStatus, "DELIVERED");
  if (delivered.deliveryStatus !== "DELIVERED")
    throw new Error("Expected delivered fixture");
  const message = delivered.message;
  const local = createRequire(
    new URL(
      "../src/features/messages/hooks/use-attachment-recovery.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-attachment-recovery.ts");
  const slots: unknown[] = [];
  let cursor = 0,
    current = true,
    focused = true,
    offline = false;
  type Effect = { deps: unknown[]; cleanup?: () => void };
  const effects: Effect[] = [];
  const queued: (() => void)[] = [];
  const listeners = new Set<(state: string) => void>();
  const appState = {
    currentState: "active",
    addEventListener: (_name: string, fn: (state: string) => void) => {
      listeners.add(fn);
      return { remove: () => listeners.delete(fn) };
    },
  };
  const failed = {
    moderationStatus: "FAILED" as const,
    accessStatus: "UNAVAILABLE" as const,
    canRetry: true,
  };
  const pending = {
    ...failed,
    moderationStatus: "PENDING" as const,
    accessStatus: "PENDING_SCAN" as const,
    canRetry: false,
  };
  let read: () => Promise<typeof failed | typeof pending> = async () => failed;
  let retry = async (signal?: AbortSignal) => {
    assert.equal(signal?.aborted, false);
    return {
      ...pending,
      fileId: message.attachments[0]!.fileId,
      state: "QUARANTINED",
      generation: 1,
    };
  };
  let gets = 0,
    posts = 0;
  const refreshes: unknown[][] = [];
  const runtime = {
    key: ["connections", "me", 1],
    enabled: true,
    isCurrent: () => current,
    assertCurrent: () => {
      if (!current) throw new AppError("session");
    },
  };
  const query: {
    data: typeof failed | typeof pending;
    error?: unknown;
    isError: boolean;
    isFetching: boolean;
    denied: boolean;
    refetch: () => Promise<{
      data?: typeof failed | typeof pending;
      error?: unknown;
    }>;
  } = {
    data: failed,
    isError: false,
    isFetching: false,
    denied: false,
    refetch: async () => {
      gets++;
      try {
        query.data = await read();
        query.error = undefined;
        return { data: query.data };
      } catch (error) {
        query.error = error;
        return { data: query.data, error };
      }
    },
  };
  const mocks = {
    react: {
      useState: (initial: unknown) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [
          slots[index],
          (value: unknown) => {
            slots[index] = value;
          },
        ];
      },
      useRef: (value: unknown) => {
        const index = cursor++;
        return (slots[index] ??= { current: value });
      },
      useCallback: (fn: unknown, deps: unknown[]) => {
        const index = cursor++;
        const previous = slots[index] as
          { fn: unknown; deps: unknown[] } | undefined;
        if (!previous || deps.some((value, i) => value !== previous.deps[i]))
          slots[index] = { fn, deps };
        return (slots[index] as { fn: unknown }).fn;
      },
      useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
        const index = cursor++;
        const previous = effects[index];
        if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
          queued.push(() => {
            previous?.cleanup?.();
            effects[index] = { deps, cleanup: effect() };
          });
        }
      },
    },
    "react-native": { AppState: appState },
    "expo-router": { useIsFocused: () => focused },
    "expo-network": { useNetworkState: () => ({ isConnected: !offline }) },
    "@tanstack/react-query": { useQueryClient: () => cache },
    "@/features/connections": {
      useConnections: () => runtime,
      useConnectionQuery: () => query,
    },
    "./use-messages-api": {
      useMessagesApi: () => ({
        retryAttachment: (
          _id: string,
          _fileId: string,
          signal?: AbortSignal,
        ) => {
          posts++;
          return retry(signal);
        },
      }),
    },
    "../utils/event-hydration": {
      reloadChatEventQueries: async (...args: unknown[]) => {
        refreshes.push(args);
      },
    },
  };
  const cache = {};
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  delete local.cache[filename];
  const { useAttachmentRecovery } = local(
    filename,
  ) as typeof import("../src/features/messages/hooks/use-attachment-recovery");
  const file = {
    ...message.attachments[0]!,
    ...failed,
    availability: failed.accessStatus,
  };
  return {
    message,
    render: () => {
      cursor = 0;
      const result = useAttachmentRecovery(message, file);
      queued.splice(0).forEach((effect) => effect());
      return result;
    },
    failed,
    pending,
    query,
    refreshes,
    counts: () => ({ gets, posts }),
    read: (next: typeof read) => {
      read = next;
    },
    retry: (next: typeof retry) => {
      retry = next;
    },
    expire: () => {
      current = false;
    },
    offline: () => {
      offline = true;
    },
    blur: () => {
      focused = false;
    },
    background: () => {
      appState.currentState = "background";
      listeners.forEach((fn) => fn("background"));
    },
    foreground: () => {
      appState.currentState = "active";
      listeners.forEach((fn) => fn("active"));
    },
    cleanup: () => {
      effects.forEach((effect) => effect?.cleanup?.());
      contexts.reverse().forEach((context) => context.restore());
      delete local.cache[filename];
    },
  };
}

test("published recovery reads permission on every tap, blocks duplicate requests and only refreshes existing messages", async () => {
  const h = harness();
  const read = deferred<typeof h.failed>();
  h.read(() => read.promise);
  try {
    const state = h.render();
    const first = state.retry();
    await state.retry();
    assert.deepEqual(h.counts(), { gets: 1, posts: 0 });
    assert.equal(h.render().pending, true);
    read.resolve(h.failed);
    await first;
    assert.deepEqual(h.counts(), { gets: 1, posts: 1 });
    assert.equal(h.render().pending, false);
    assert.equal(h.refreshes.length, 1);
    assert.equal(h.refreshes[0]!.at(-1), h.message.conversationId);
  } finally {
    h.cleanup();
  }
});

test("unknown requeue result requires a read-only check before another explicit retry", async () => {
  const h = harness();
  h.retry(async () => {
    throw new AppError("network");
  });
  try {
    await h.render().retry();
    assert.equal(h.render().uncertain, true);
    h.read(async () => h.pending);
    await h.render().retry();
    assert.deepEqual(h.counts(), { gets: 2, posts: 1 });
    assert.equal(h.render().uncertain, false);
    assert.equal(h.render().error, undefined);
  } finally {
    h.cleanup();
  }
});

test("background, blur, offline and an expired owner cannot turn a late status response into a POST", async () => {
  for (const action of ["background", "blur", "offline", "expire"] as const) {
    const h = harness();
    const read = deferred<typeof h.failed>();
    h.read(() => read.promise);
    try {
      const pending = h.render().retry();
      h[action]();
      if (action !== "background") h.render();
      read.resolve(h.failed);
      await pending;
      await flush();
      assert.equal(h.counts().posts, 0);
      assert.equal(h.refreshes.length, 0);
    } finally {
      h.cleanup();
    }
  }
});

test("a stale cached retry grant cannot override a fresh denial", async () => {
  const h = harness();
  h.read(async () => ({ ...h.failed, canRetry: false }));
  try {
    await h.render().retry();
    assert.deepEqual(h.counts(), { gets: 1, posts: 0 });
  } finally {
    h.cleanup();
  }
});

test("a rapid background/foreground transition releases cancelled work before React commits a paused render", async () => {
  const h = harness();
  const read = deferred<typeof h.failed>();
  h.read(() => read.promise);
  try {
    const first = h.render().retry();
    h.background();
    h.foreground();
    read.resolve(h.failed);
    await first;
    const resumed = h.render();
    assert.equal(h.counts().posts, 0);
    assert.equal(
      resumed.pending,
      false,
      "the cancelled request must not leave a permanent busy flag",
    );
    assert.equal(resumed.disabled, false);
    h.read(async () => h.failed);
    await resumed.retry();
    assert.deepEqual(h.counts(), { gets: 2, posts: 1 });
  } finally {
    h.cleanup();
  }
});

test("a cancelled late read cannot submit or clear a new operation after resume", async () => {
  const h = harness();
  const oldRead = deferred<typeof h.failed>();
  const newRead = deferred<typeof h.failed>();
  h.read(() => oldRead.promise);
  try {
    const first = h.render().retry();
    h.background();
    h.foreground();
    h.read(() => newRead.promise);
    const next = h.render().retry();
    oldRead.resolve(h.failed);
    await first;
    assert.equal(
      h.render().pending,
      true,
      "the old request must not clear the new operation's guard",
    );
    assert.equal(h.counts().posts, 0);
    newRead.resolve(h.failed);
    await next;
    assert.deepEqual(h.counts(), { gets: 2, posts: 1 });
    assert.equal(h.render().pending, false);
  } finally {
    h.cleanup();
  }
});
