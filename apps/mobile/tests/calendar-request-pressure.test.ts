import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  QueryClient,
  QueryObserver,
  type QueryObserverOptions,
} from "@tanstack/react-query";
import { AppError } from "../src/lib/http/errors";
import { sessionsFixture } from "./fixtures/sessions-client";

function harness() {
  const local = createRequire(
    new URL("../src/features/sessions/hooks/use-sessions.ts", import.meta.url),
  );
  const filename = local.resolve("./use-sessions.ts");
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let calls = 0,
    fail = false,
    hold = false,
    signal: AbortSignal | undefined;
  let complete!: () => void,
    focus: () => (() => void) | undefined = () => undefined;
  let effects: (() => void)[] = [],
    staleTime: unknown;
  let observer: QueryObserver | undefined, stop: (() => void) | undefined;
  const visited = { current: false };
  const runtime = {
    ...sessionsFixture(),
    enabled: true,
    key: ["sessions", "owner", 1],
    isCurrent: () => true,
  };
  runtime.api.list = async (_range, requestSignal) => {
    calls++;
    signal = requestSignal;
    if (hold)
      await new Promise<void>((resolve, reject) => {
        complete = resolve;
        requestSignal?.addEventListener(
          "abort",
          () => reject(new AppError("session")),
          { once: true },
        );
      });
    if (fail) throw new AppError("http", 403);
    return [];
  };
  const mocks = {
    react: {
      useMemo: (fn: () => unknown) => fn(),
      useCallback: (fn: unknown) => fn,
      useRef: () => visited,
      useEffect: (fn: () => void) => effects.push(fn),
    },
    "react-native": { AppState: { addEventListener: () => ({ remove() {} }) } },
    "expo-router": {
      useFocusEffect: (fn: typeof focus) => {
        focus = fn;
      },
    },
    "@tanstack/react-query": {
      useQueryClient: () => cache,
      useQuery: (options: QueryObserverOptions) => {
        staleTime = options.staleTime;
        if (!observer) {
          observer = new QueryObserver(cache, options);
          stop = observer.subscribe(() => {});
        } else observer.setOptions(options);
        return observer.getCurrentResult();
      },
    },
    "../runtime": { useSessionsRuntime: () => runtime },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  delete local.cache[filename];
  const hooks = local(
    filename,
  ) as typeof import("../src/features/sessions/hooks/use-sessions");
  return {
    render(
      range = { from: "2026-10-01T00:00:00Z", to: "2026-10-31T23:59:59Z" },
      active = true,
    ) {
      effects = [];
      const result = hooks.useSessionList(range, "UTC", active);
      effects.forEach((effect) => effect());
      return result;
    },
    detail() {
      hooks.useSessionDetail(undefined);
      return staleTime;
    },
    focus: () => focus(),
    finish: () => complete(),
    get calls() {
      return calls;
    },
    get signal() {
      return signal;
    },
    set hold(value: boolean) {
      hold = value;
    },
    set fail(value: boolean) {
      fail = value;
    },
    cleanup() {
      stop?.();
      cache.clear();
      delete local.cache[filename];
      contexts.reverse().forEach((context) => context.restore());
    },
  };
}

test("Calendar reuses fresh months on focus and return, but manual refresh still reads; detail stays stale immediately", async () => {
  const h = harness();
  try {
    h.hold = true;
    const first = h.render();
    h.focus()?.();
    const initial = first.refetch({ cancelRefetch: false });
    h.focus()?.();
    assert.equal(h.calls, 1);
    h.hold = false;
    h.finish();
    await initial;
    assert.equal(h.calls, 1);
    for (let i = 0; i < 5; i++) h.focus()?.();
    assert.equal(h.calls, 1);
    await h.render().refetch({ cancelRefetch: false });
    assert.equal(h.calls, 2);
    const next = h.render({
      from: "2026-11-01T00:00:00Z",
      to: "2026-11-30T23:59:59Z",
    });
    await next.refetch({ cancelRefetch: false });
    assert.equal(h.calls, 3);
    h.render();
    h.focus()?.();
    assert.equal(
      h.calls,
      3,
      "returning to the fresh previous month must use cache",
    );
    assert.equal(
      h.detail(),
      0,
      "detail freshness must not be relaxed by Calendar optimization",
    );
  } finally {
    h.cleanup();
  }
});

test("leaving Calendar aborts its pending month read; a later403 still hides cached sessions", async () => {
  const h = harness();
  try {
    h.hold = true;
    h.render();
    assert.equal(h.signal?.aborted, false);
    h.render(undefined, false);
    assert.equal(h.signal?.aborted, true);
    h.hold = false;
    await h.render().refetch({ cancelRefetch: false });
    h.fail = true;
    await h.render().refetch({ cancelRefetch: false });
    const denied = h.render();
    assert.equal(denied.denial, "forbidden");
    assert.equal(denied.data, undefined);
  } finally {
    h.cleanup();
  }
});
