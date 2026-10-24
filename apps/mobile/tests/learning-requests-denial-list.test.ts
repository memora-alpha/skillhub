import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  QueryClient,
  InfiniteQueryObserver,
  hashKey,
  queryOptions,
  infiniteQueryOptions,
} from "@tanstack/react-query";
import { createRequestsApi } from "../src/features/learning-requests/api/requests-api";
import { requestListOptions } from "../src/features/learning-requests/utils/request-list-query";
import { fixtureRequest } from "./fixtures/learning-requests-data";
import { AppError } from "../src/lib/http/errors";

for (const nextPage of [false, true])
  test(`list denial clears cached pages and cannot return on a later 503 (next-page=${nextPage})`, async () => {
    const local = createRequire(
      new URL(
        "../src/features/learning-requests/hooks/use-requests.ts",
        import.meta.url,
      ),
    );
    const filename = local.resolve("./use-requests.ts");
    const cache = new QueryClient({
      defaultOptions: { queries: { staleTime: 30000, gcTime: Infinity } },
    });
    let failure: AppError | undefined;
    const api = {
      ...createRequestsApi({
        bindSession() {},
        request: async () => {
          throw Error("Unexpected transport");
        },
      }),
      list: async () => {
        if (failure) throw failure;
        return { items: [fixtureRequest()], hasMore: true, nextCursor: "next" };
      },
    };
    const key = ["lr", "owner", 1];
    const options = requestListOptions(api, key, "mine", {});
    const observer = new InfiniteQueryObserver(cache, options);
    const stop = observer.subscribe(() => {});
    const effects: (() => void)[] = [];
    const mocks = {
      react: {
        useCallback: (fn: unknown) => fn,
        useMemo: (fn: () => unknown) => fn(),
        useEffect: (fn: () => void) => effects.push(fn),
      },
      "react-native": { AppState: {} },
      "expo-router": { useFocusEffect() {} },
      "@tanstack/react-query": {
        hashKey,
        queryOptions,
        infiniteQueryOptions,
        useQueryClient: () => cache,
        useQuery() {},
        useInfiniteQuery: () => observer.getCurrentResult(),
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
    const contexts = Object.entries(mocks).map(([name, namedExports]) =>
      mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
    );
    try {
      await observer.refetch({ cancelRefetch: false });
      delete local.cache[filename];
      const { useRequestList } = local(
        filename,
      ) as typeof import("../src/features/learning-requests/hooks/use-requests");
      const render = () => {
        effects.length = 0;
        const result = useRequestList("mine", {}, true);
        effects.forEach((fn) => fn());
        return result;
      };
      assert.equal(render().items.length, 1);
      failure = new AppError("http", 403);
      if (nextPage) await observer.fetchNextPage();
      else await observer.refetch();
      const denied = render();
      assert.deepEqual(denied.items, []);
      assert.equal(denied.data, undefined);
      assert.equal(
        denied.isFetchNextPageError,
        false,
        "denial must show a screen error with full refresh recovery",
      );
      assert.equal(denied.hasNextPage, false);
      assert.equal(cache.getQueryData(options.queryKey), undefined);
      assert.equal(
        cache.getQueryState(options.queryKey)?.error,
        failure,
        "eviction must preserve the 403 error banner",
      );
      failure = new AppError("http", 503);
      await observer.refetch();
      assert.deepEqual(render().items, []);
      assert.equal(render().data, undefined);
      await cache.cancelQueries({ queryKey: options.queryKey });
      assert.equal(cache.getQueryData(options.queryKey), undefined);
      failure = undefined;
      await observer.refetch();
      assert.equal(render().items.length, 1);
      assert.ok(render().data);
    } finally {
      delete local.cache[filename];
      contexts.reverse().forEach((c) => c.restore());
      stop();
      cache.clear();
    }
  });
