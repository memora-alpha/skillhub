import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  QueryClient,
  QueryObserver,
  type QueryObserverOptions,
} from "@tanstack/react-query";
import {
  cachedOwnRequest,
  REQUEST_DETAIL_CACHE_MS,
} from "../src/features/learning-requests/utils/request-detail-cache";
import { RequestReadGuard } from "../src/features/learning-requests/utils/request-read";
import { AppError } from "../src/lib/http/errors";
import { fixtureId, fixtureRequest } from "./fixtures/learning-requests-data";
import { requestListOptions } from "../src/features/learning-requests/utils/request-list-query";
import type { createRequestsApi } from "../src/features/learning-requests/api/requests-api";

test("own title cache is scoped, reports freshness, and never revives a known detail or list denial", () => {
  const cache = new QueryClient();
  const key = ["learning-requests", fixtureId(1), 1];
  const id = fixtureId(100),
    access = new RequestReadGuard();
  const at = Date.now(),
    item = fixtureRequest({ id });
  const page = {
    pages: [{ items: [item], hasMore: false, nextCursor: null }],
    pageParams: [undefined],
  };
  cache.setQueryData(
    ["learning-requests", fixtureId(2), 1, "list", "mine", {}],
    page,
  );
  cache.setQueryData([...key, "list", "feed", {}], page);
  assert.equal(cachedOwnRequest(cache, key, id, access, at), undefined);
  const mineKey = [...key, "list", "mine", {}];
  cache.setQueryData(mineKey, page, { updatedAt: at });
  assert.equal(
    cachedOwnRequest(cache, key, id, access, at)?.item.title,
    item.title,
  );
  assert.equal(cachedOwnRequest(cache, key, id, access, at)?.fresh, true);
  assert.equal(
    cachedOwnRequest(cache, key, id, access, at + REQUEST_DETAIL_CACHE_MS + 1)
      ?.fresh,
    false,
  );
  access.fail(new AppError("http", 403));
  assert.equal(cachedOwnRequest(cache, key, id, access, at), undefined);
  const list = cache.getQueryCache().find({ queryKey: mineKey, exact: true })!;
  list.setState({ error: new AppError("http", 403) });
  assert.equal(
    cachedOwnRequest(cache, key, id, new RequestReadGuard(), at),
    undefined,
  );
  cache.clear();
});

test("Inbox title catalog reads one page even if the normal mine list has many pages cached", async () => {
  const cache = new QueryClient();
  const base = ["learning-requests", fixtureId(1), 1];
  const cursors: (string | undefined)[] = [];
  const list: ReturnType<typeof createRequestsApi>["list"] = async (
    _scope,
    _filters,
    cursor,
  ) => {
    cursors.push(cursor);
    return { items: [fixtureRequest()], nextCursor: "more", hasMore: true };
  };
  const api = { list } as ReturnType<typeof createRequestsApi>;
  const normal = requestListOptions(api, base, "mine", {});
  const catalog = requestListOptions(api, base, "mine", {}, true);
  const normalPages = {
    pages: Array.from({ length: 5 }, () => ({
      items: [fixtureRequest()],
      nextCursor: "more",
      hasMore: true,
    })),
    pageParams: [undefined, "p2", "p3", "p4", "p5"],
  };
  cache.setQueryData(normal.queryKey, normalPages);
  await cache.fetchInfiniteQuery(catalog);
  await cache.refetchQueries({ queryKey: catalog.queryKey, exact: true });
  assert.deepEqual(cursors, [undefined, undefined]);
  assert.equal(cache.getQueryData(normal.queryKey), normalPages);
  assert.equal(cache.getQueryData(catalog.queryKey)?.pages.length, 1);
  cache.clear();
});

test("one owned page supplies twenty Inbox names without twenty detail requests, including fresh focus and stale-list refresh", async () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/hooks/use-requests.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-requests.ts");
  const cache = new QueryClient({
    defaultOptions: {
      queries: { staleTime: REQUEST_DETAIL_CACHE_MS, retry: false },
    },
  });
  const key = ["learning-requests", fixtureId(1), 1];
  const items = Array.from({ length: 20 }, (_, n) =>
    fixtureRequest({ id: fixtureId(100 + n), title: `Bài ${n}` }),
  );
  let listReads = 0;
  const detailReads: string[] = [];
  const observers = new Map<string, QueryObserver>();
  const stops: (() => void)[] = [];
  const api = {
    detail: async (id: string) => {
      detailReads.push(id);
      return fixtureRequest({ id });
    },
  };
  const loadPage = async () => {
    listReads++;
    return {
      pages: [{ items, hasMore: false, nextCursor: null }],
      pageParams: [undefined],
    };
  };
  cache.setQueryData([...key, "list", "mine", {}], await loadPage());
  const mocks = {
    react: {
      useMemo: (fn: () => unknown) => fn(),
      useCallback: (fn: unknown) => fn,
      useEffect: (fn: () => void) => fn(),
    },
    "react-native": { AppState: { addEventListener: () => ({ remove() {} }) } },
    "expo-router": { useFocusEffect: (fn: () => unknown) => fn() },
    "@tanstack/react-query": {
      useQueryClient: () => cache,
      useQuery: (options: QueryObserverOptions) => {
        const id = JSON.stringify(options.queryKey);
        let observer = observers.get(id);
        if (!observer) {
          observer = new QueryObserver(cache, options);
          observers.set(id, observer);
          stops.push(observer.subscribe(() => {}));
        } else observer.setOptions(options);
        return observer.getCurrentResult();
      },
    },
    "../context": {
      useRequestsRuntime: () => ({
        api,
        key,
        enabled: true,
        isCurrent: () => true,
      }),
    },
  };
  const handles = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useRequestDetail } = local(
      filename,
    ) as typeof import("../src/features/learning-requests/hooks/use-requests");
    const options = { preferOwnList: true, refreshOnFocus: "stale" as const };
    for (const item of items) {
      const result = useRequestDetail(item.id, options);
      assert.equal(result.data?.title, item.title);
      assert.equal(result.isPending, false);
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(listReads, 1);
    assert.deepEqual(detailReads, []);
    cache.setQueryData([...key, "list", "mine", {}], await loadPage(), {
      updatedAt: Date.now() - REQUEST_DETAIL_CACHE_MS - 1,
    });
    for (const item of items)
      assert.equal(
        useRequestDetail(item.id, { ...options, waitForOwnList: true }).data
          ?.title,
        item.title,
      );
    assert.deepEqual(detailReads, []);
    for (const item of items) useRequestDetail(item.id, options);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(
      detailReads,
      [],
      "a stale display snapshot must not suddenly fan out twenty title reads",
    );
    cache.setQueryData([...key, "list", "mine", {}], await loadPage());
    for (const item of items) useRequestDetail(item.id, options);
    assert.deepEqual(detailReads, []);
    const uncovered = fixtureId(300);
    useRequestDetail(uncovered, options);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(
      detailReads,
      [uncovered],
      "only the request missing from mine needs its own detail read",
    );
    useRequestDetail(uncovered, options);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(
      detailReads,
      [uncovered],
      "fresh detail is reused on Inbox focus too",
    );
  } finally {
    stops.forEach((stop) => stop());
    cache.clear();
    delete local.cache[filename];
    handles.reverse().forEach((h) => h.restore());
  }
});

test("leaving an Inbox title cancels its queued transport through the API AbortSignal", async () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/hooks/use-requests.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-requests.ts");
  const cache = new QueryClient();
  const key = ["learning-requests", fixtureId(1), 1];
  let observer: QueryObserver | undefined,
    stop: (() => void) | undefined,
    signal: AbortSignal | undefined;
  const mocks = {
    react: {
      useMemo: (fn: () => unknown) => fn(),
      useCallback: (fn: unknown) => fn,
      useEffect: (fn: () => void) => fn(),
    },
    "react-native": { AppState: {} },
    "expo-router": { useFocusEffect() {} },
    "@tanstack/react-query": {
      useQueryClient: () => cache,
      useQuery: (options: QueryObserverOptions) => {
        if (!observer) {
          observer = new QueryObserver(cache, options);
          stop = observer.subscribe(() => {});
        } else observer.setOptions(options);
        return observer.getCurrentResult();
      },
    },
    "../context": {
      useRequestsRuntime: () => ({
        key,
        enabled: true,
        isCurrent: () => true,
        api: {
          detail: (_id: string, next: AbortSignal) => {
            signal = next;
            return new Promise<never>((_resolve, reject) =>
              next.addEventListener(
                "abort",
                () => reject(new AppError("session")),
                { once: true },
              ),
            );
          },
        },
      }),
    },
  };
  const handles = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useRequestDetail } = local(
      filename,
    ) as typeof import("../src/features/learning-requests/hooks/use-requests");
    useRequestDetail(fixtureId(100), { active: true, refreshOnFocus: "stale" });
    assert.equal(signal?.aborted, false);
    useRequestDetail(fixtureId(100), {
      active: false,
      refreshOnFocus: "stale",
    });
    assert.equal(signal?.aborted, true);
  } finally {
    stop?.();
    cache.clear();
    delete local.cache[filename];
    handles.reverse().forEach((h) => h.restore());
  }
});
