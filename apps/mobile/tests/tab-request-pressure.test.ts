import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  InfiniteQueryObserver,
  QueryClient,
  QueryObserver,
  type InfiniteQueryObserverOptions,
  type QueryObserverOptions,
} from "@tanstack/react-query";
import { RequestCoordinator } from "../src/lib/http/rate-limit";
import { AppError } from "../src/lib/http/errors";
import { readHarness } from "./skills-read-harness";

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("rapid reads across tabs are paced even with instant responses; cancelled queued reads never reach transport", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  const coordinator = new RequestCoordinator(() => Date.now());
  const calls: { path: string; at: number }[] = [];
  const aborted = new AbortController();
  const reads = Array.from({ length: 12 }, (_, index) => {
    const path = ["/wallet", "/sessions", "/requests", "/skills"][index % 4]!;
    return coordinator.run(
      `${path}/${index}`,
      "GET",
      index === 4 ? aborted.signal : undefined,
      async () => calls.push({ path, at: Date.now() }),
    );
  });
  const cancelled = assert.rejects(
    reads[4]!,
    (error) => error instanceof AppError && error.kind === "session",
  );
  aborted.abort();
  await settle();
  assert.equal(calls.length, 4);
  // A user action is never queued behind screen reads or replayed later.
  let writes = 0;
  await coordinator.run("/save", "POST", undefined, async () => writes++);
  assert.equal(writes, 1);
  t.mock.timers.tick(999);
  await settle();
  assert.equal(calls.length, 4);
  t.mock.timers.tick(1);
  await settle();
  assert.equal(calls.length, 8);
  t.mock.timers.tick(1000);
  await Promise.all([...reads.filter((_, index) => index !== 4), cancelled]);
  assert.equal(calls.length, 11);
  assert.deepEqual(
    calls.map(({ at }) => at),
    [1000, 1000, 1000, 1000, 2000, 2000, 2000, 2000, 3000, 3000, 3000],
  );
  assert.equal(writes, 1);
});

test("a global 429 rejects paced queued reads immediately and does not send them after cooldown", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  const coordinator = new RequestCoordinator(() => Date.now());
  let calls = 0;
  await Promise.all(
    Array.from({ length: 4 }, () =>
      coordinator.run("/initial", "GET", undefined, async () => calls++),
    ),
  );
  const next = coordinator.run(
    "/calendar",
    "GET",
    undefined,
    async () => calls++,
  );
  const rejected = assert.rejects(
    next,
    (error) => error instanceof AppError && error.retryAt === 61000,
  );
  coordinator.record(
    "/requests",
    "GET",
    new AppError("http", 429, "RATE_LIMITED", 61000),
  );
  await rejected;
  t.mock.timers.tick(60000);
  await settle();
  assert.equal(calls, 4);
});

test("Home wallet focus uses fresh shared cache, invalidation and explicit refresh still read", async () => {
  const local = createRequire(
    new URL("../src/features/wallet/hooks/use-wallet.ts", import.meta.url),
  );
  const filename = local.resolve("./use-wallet.ts");
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const key = ["wallet", "owner", 1, "balance"];
  let calls = 0,
    focused = true;
  let focus!: () => () => void;
  let foreground!: (state: string) => void;
  let observer: QueryObserver | undefined, stop: (() => void) | undefined;
  const runtime = {
    capabilities: { wallet: true },
    isCurrent: () => true,
    client: {},
    addCleanup: () => () => {},
  };
  const mocks = {
    react: { useCallback: (fn: unknown) => fn },
    "react-native": {
      AppState: {
        addEventListener: (_: string, fn: typeof foreground) => {
          foreground = fn;
          return { remove() {} };
        },
      },
    },
    "expo-router": {
      useIsFocused: () => focused,
      useFocusEffect: (fn: typeof focus) => {
        focus = fn;
      },
    },
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
    "../context/WalletProvider": { useOptionalWalletRuntime: () => runtime },
    "../utils/wallet-query": {
      walletReadOptions: () => ({
        queryKey: key,
        enabled: true,
        staleTime: 30000,
        queryFn: async () => ++calls,
      }),
      projectWalletRead: (_: unknown, result: unknown) => result,
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useWallet } = local(filename) as {
      useWallet: () => { refresh: () => Promise<unknown> };
    };
    const view = useWallet();
    const cleanup = focus();
    await cache.refetchQueries({ queryKey: key }, { cancelRefetch: false });
    assert.equal(calls, 1);
    for (let index = 0; index < 8; index++) {
      focused = false;
      useWallet();
      focused = true;
      useWallet();
      focus()();
      foreground("active");
    }
    await settle();
    assert.equal(calls, 1);
    await cache.invalidateQueries({ queryKey: key, refetchType: "none" });
    foreground("active");
    await settle();
    assert.equal(calls, 2);
    await view.refresh();
    assert.equal(calls, 3);
    cleanup();
  } finally {
    stop?.();
    cache.clear();
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});

test("Profile skill preview reuses fresh pages across focus; management stays immediately stale and denial hides data", async () => {
  const h = readHarness();
  const key = [...h.runtime.scope, "own", false, "ALL"];
  let calls = 0;
  const own = h.runtime.api.own;
  h.runtime.api.own = async (...args) => {
    calls++;
    return own(...args);
  };
  h.hooks.useOwnSkills!("ALL", { preview: true, enabled: true });
  const options = h.options(key) as InfiniteQueryObserverOptions;
  const observer = new InfiniteQueryObserver(h.client, options);
  const stop = observer.subscribe(() => {});
  try {
    await observer.refetch({ cancelRefetch: false });
    for (let i = 0; i < 8; i++) await h.focusReads[0]!.refresh();
    assert.equal(calls, 1);
    await h.client.invalidateQueries({ queryKey: key, refetchType: "none" });
    await h.focusReads[0]!.refresh();
    assert.equal(calls, 2);
    await observer.refetch({ cancelRefetch: false });
    assert.equal(calls, 3);
    h.hooks.useOwnSkills!("ALL", { preview: true, enabled: false });
    assert.equal(h.options(key).enabled, false);
    assert.equal(h.focusReads.at(-1)!.enabled, false);
    h.hooks.useOwnSkills!();
    assert.equal(h.options(key).staleTime, 0);
    h.status(403);
    await observer.refetch();
    const denied = h.hooks.useOwnSkills!("ALL", { preview: true }) as {
      data?: unknown;
      readDenied?: unknown;
    };
    assert.equal(denied.data, undefined);
    assert.ok(denied.readDenied);
  } finally {
    stop();
    h.client.clear();
  }
});
