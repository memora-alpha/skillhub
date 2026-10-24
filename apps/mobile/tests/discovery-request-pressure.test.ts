import assert from "node:assert/strict";
import test from "node:test";
import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
import { createRequestsApi } from "../src/features/learning-requests/api/requests-api";
import {
  requestListOptions,
  refreshRequestList,
} from "../src/features/learning-requests/utils/request-list-query";
import { AppError } from "../src/lib/http/errors";

const unused = createRequestsApi({
  bindSession() {},
  request: async () => {
    throw Error("Unexpected request");
  },
});

test("Discovery initial load shares focus refresh; repeated focus reuses all fresh pages", async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { staleTime: 30000, retry: false } },
  });
  let calls = 0,
    finish!: () => void;
  const first = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const api = {
    ...unused,
    list: async (_scope: unknown, _filters: unknown, cursor?: string) => {
      if (++calls === 1) await first;
      return {
        items: [],
        hasMore: !cursor,
        nextCursor: cursor ? null : "next",
      };
    },
  };
  const options = requestListOptions(api, ["lr", "owner", 1], "feed", {});
  const observer = new InfiniteQueryObserver(cache, options);
  const stop = observer.subscribe(() => {});
  try {
    const focus = refreshRequestList(cache, options.queryKey, true);
    assert.equal(calls, 1);
    finish();
    await focus;
    await observer.fetchNextPage();
    assert.equal(calls, 2);
    for (let i = 0; i < 5; i++)
      await refreshRequestList(cache, options.queryKey, true);
    assert.equal(
      calls,
      2,
      "returning to a fresh Discovery tab must not scan pages again",
    );
    await cache.invalidateQueries({
      queryKey: options.queryKey,
      exact: true,
      refetchType: "none",
    });
    await Promise.all([
      refreshRequestList(cache, options.queryKey, true),
      refreshRequestList(cache, options.queryKey, true),
    ]);
    assert.equal(calls, 4, "two focus triggers share one two-page refetch");
    await refreshRequestList(cache, options.queryKey, false);
    assert.equal(
      calls,
      6,
      "manual refresh still reads the complete cursor chain",
    );
  } finally {
    stop();
    cache.clear();
  }
});

test("changing Discovery search aborts the obsolete HTTP read rather than just ignoring its result", async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let previous: AbortSignal | undefined;
  const api = createRequestsApi({
    bindSession() {},
    request: async (path, opts) => {
      if (path.includes("keyword=old")) {
        previous = opts?.signal;
        return new Promise((_resolve, reject) =>
          opts?.signal?.addEventListener(
            "abort",
            () => reject(new AppError("session")),
            { once: true },
          ),
        );
      }
      return {
        data: [],
        meta: { pagination: { hasMore: false, nextCursor: null, limit: 20 } },
      };
    },
  });
  const base = ["lr", "owner", 1];
  const observer = new InfiniteQueryObserver(
    cache,
    requestListOptions(api, base, "feed", { keyword: "old" }),
  );
  const stop = observer.subscribe(() => {});
  try {
    assert.equal(previous?.aborted, false);
    observer.setOptions(
      requestListOptions(api, base, "feed", { keyword: "new" }),
    );
    const result = await observer.refetch({ cancelRefetch: false });
    assert.equal(previous?.aborted, true);
    assert.equal(result.error, null);
    assert.deepEqual(result.data?.pages[0]?.items, []);
  } finally {
    stop();
    cache.clear();
  }
});

test("request catalogs receive AbortSignal so closing an obsolete picker can cancel transport", async () => {
  const signals: AbortSignal[] = [];
  const api = createRequestsApi({
    bindSession() {},
    request: async (_path, opts) => {
      assert.ok(opts?.signal);
      signals.push(opts.signal);
      return new Promise((_resolve, reject) =>
        opts.signal!.addEventListener(
          "abort",
          () => reject(new AppError("session")),
          { once: true },
        ),
      );
    },
  });
  const control = new AbortController();
  const reads = [
    api.skills(undefined, "react", control.signal),
    api.tags(undefined, "web", control.signal),
  ];
  const rejected = reads.map((read) =>
    assert.rejects(read, (e) => e instanceof AppError && e.kind === "session"),
  );
  control.abort();
  await Promise.all(rejected);
  assert.equal(signals.length, 2);
  assert.ok(signals.every((signal) => signal.aborted));
});
