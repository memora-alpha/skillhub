import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { createMessagesApi } from "../src/features/messages/api/messages-api";
import {
  createChatEventHydrator,
  reloadChatEventQueries,
} from "../src/features/messages/utils/event-hydration";
import { AppError } from "../src/lib/http/errors";
import type { FileModerationStatus } from "../src/lib/http/file-upload";
import { fixtureId } from "./fixtures/learning-requests-data";

const signal = new AbortController().signal;
const ready = (id: string) => ({ event: "stream.ready", id, data: "{}" });
const updated = (id: number) => ({
  event: "chat.attachment.updated",
  id: `cursor-${id}`,
  data: JSON.stringify({
    version: 1,
    eventId: fixtureId(id),
    data: { fileId: fixtureId(40), state: "READY" },
  }),
});

function fixture() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const base = ["connections", "current-owner", 1];
  const key = [...base, "chat-file", fixtureId(10), fixtureId(40)];
  let server = {
    fileId: fixtureId(40),
    generation: 1,
    state: "QUARANTINED",
    moderationStatus: "PENDING" as FileModerationStatus | undefined,
  };
  let failure: unknown,
    current = true,
    reads = 0,
    readyCount = 0;
  const api = createMessagesApi(async (path) => {
    assert.equal(
      path,
      `/conversations/${fixtureId(10)}/attachments/${fixtureId(40)}/status`,
    );
    reads++;
    if (failure) throw failure;
    return server;
  }, fixtureId(1));
  const observer = new QueryObserver(cache, {
    queryKey: key,
    queryFn: () => api.fileStatus(fixtureId(10), fixtureId(40)),
    initialData: server,
    staleTime: Infinity,
  });
  const stop = observer.subscribe(() => {});
  const otherKey = ["connections", "other-owner", 1, ...key.slice(base.length)];
  const other = new QueryObserver(cache, {
    queryKey: otherKey,
    queryFn: async () => {
      throw new Error("must not read another owner");
    },
    initialData: server,
    staleTime: Infinity,
  });
  const stopOther = other.subscribe(() => {});
  const assertCurrent = () => {
    if (!current) throw new AppError("session");
  };
  const hydration = createChatEventHydrator({
    reload: (prefixes, receiptsFor) =>
      reloadChatEventQueries(cache, base, prefixes, receiptsFor, assertCurrent),
    assertCurrent,
    renew: async () => {},
    ready: () => {
      readyCount++;
    },
  });
  return {
    hydration,
    reads: () => reads,
    readyCount: () => readyCount,
    data: () => observer.getCurrentResult().data,
    otherData: () => cache.getQueryData(otherKey),
    server: (state: string, moderationStatus?: FileModerationStatus) => {
      server = { ...server, state, moderationStatus };
    },
    fail: (value: unknown) => {
      failure = value;
    },
    expire: () => {
      current = false;
    },
    cleanup: () => {
      stop();
      stopOther();
      cache.clear();
    },
  };
}

test("attachment events immediately hydrate authorized status and dedupe events without trusting state hints", async () => {
  const f = fixture();
  try {
    let id = 100;
    for (const [state, moderationStatus] of [
      ["QUARANTINED", "PENDING"],
      ["READY", undefined],
      ["REJECTED", undefined],
      ["QUARANTINED", "REVIEW_REQUIRED"],
      ["SCAN_FAILED", "FAILED"],
    ] as const) {
      f.server(state, moderationStatus);
      const frame = updated(id++),
        before = f.reads();
      await f.hydration.handle(frame, signal);
      assert.equal(f.reads(), before + 1);
      assert.equal(f.data()?.state, state);
      assert.equal(f.data()?.moderationStatus, moderationStatus);
      assert.equal(f.hydration.cursor, frame.id);
      await f.hydration.handle(frame, signal);
      assert.equal(
        f.reads(),
        before + 1,
        "the same event cannot cause another read",
      );
    }
    assert.equal((f.otherData() as { state: string }).state, "QUARANTINED");
  } finally {
    f.cleanup();
  }
});

test("SSE resume reads a completed attachment even when no update event is replayed", async () => {
  const f = fixture();
  try {
    await f.hydration.handle(ready("head-1"), signal);
    assert.equal(f.data()?.state, "QUARANTINED");
    f.server("READY");
    await f.hydration.handle(ready("head-2"), signal);
    assert.equal(f.reads(), 2);
    assert.equal(f.data()?.state, "READY");
    assert.equal(f.data()?.moderationStatus, undefined);
    assert.equal(f.readyCount(), 2);
  } finally {
    f.cleanup();
  }
});

test("failed status hydration retains its cursor for replay and expired owners cannot hydrate", async () => {
  const f = fixture();
  try {
    await f.hydration.handle(ready("head-1"), signal);
    f.server("READY");
    f.fail(new AppError("network"));
    await assert.rejects(f.hydration.handle(ready("head-2"), signal));
    assert.equal(f.hydration.cursor, "head-1");
    assert.equal(f.readyCount(), 1);
    assert.equal(f.data()?.state, "QUARANTINED");
    f.fail(undefined);
    await f.hydration.handle(ready("head-2"), signal);
    assert.equal(f.data()?.state, "READY");
    f.fail(new AppError("network"));
    await assert.rejects(f.hydration.handle(updated(110), signal));
    assert.equal(f.hydration.cursor, "head-2");
    f.fail(undefined);
    await f.hydration.handle(updated(110), signal);
    assert.equal(f.hydration.cursor, "cursor-110");
    const reads = f.reads();
    f.expire();
    await assert.rejects(f.hydration.handle(updated(111), signal), {
      kind: "session",
    });
    assert.equal(f.reads(), reads);
  } finally {
    f.cleanup();
  }
});
