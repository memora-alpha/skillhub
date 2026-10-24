import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";
import {
  isTransientReadError,
  readRecoveryDelay,
} from "../src/lib/query/use-quiet-read-recovery";

test("quiet recovery distinguishes transient reads from permission/session/business failures and respects server cooldown", () => {
  for (const error of [
    new AppError("network"),
    new AppError("http", 429),
    new AppError("http", 503),
  ])
    assert.equal(isTransientReadError(error), true);
  for (const error of [
    undefined,
    Error("unknown"),
    new AppError("session"),
    new AppError("config"),
    new AppError("http", 401),
    new AppError("http", 403),
    new AppError("http", 404),
    new AppError("http", 409),
  ])
    assert.equal(isTransientReadError(error), false);
  assert.equal(
    readRecoveryDelay(
      new AppError("http", 429, "RATE_LIMITED", 61000),
      4,
      1000,
    ),
    60000,
  );
  assert.equal(readRecoveryDelay(new AppError("http", 429), 0, 1000), 60000);
  assert.equal(
    readRecoveryDelay(new AppError("http", 429, "", 500), 0, 1000),
    1000,
  );
  assert.deepEqual(
    [0, 1, 2, 3, 20].map((n) => readRecoveryDelay(new AppError("network"), n)),
    [5000, 10000, 20000, 40000, 40000],
  );
});

test("quiet recovery owns one timer, uses latest callback, pauses on blur/fetch and resets after success", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  const local = createRequire(
    new URL("../src/lib/query/use-quiet-read-recovery.ts", import.meta.url),
  );
  const filename = local.resolve("./use-quiet-read-recovery.ts");
  let slot = 0,
    cleanup: (() => void) | undefined,
    previous: unknown[] | undefined;
  const refs: { current: unknown }[] = [];
  const context = mock.module(pathToFileURL(local.resolve("react")), {
    namedExports: {
      useRef: (initial: unknown) =>
        refs[slot++] ?? (refs[slot - 1] = { current: initial }),
      useEffect: (fn: () => (() => void) | undefined, deps: unknown[]) => {
        if (
          !previous ||
          deps.some((v, index) => !Object.is(v, previous![index]))
        ) {
          cleanup?.();
          cleanup = fn();
          previous = deps;
        }
      },
    },
  });
  try {
    delete local.cache[filename];
    const { useQuietReadRecovery } = local(
      filename,
    ) as typeof import("../src/lib/query/use-quiet-read-recovery");
    const render = (props: Parameters<typeof useQuietReadRecovery>[0]) => {
      slot = 0;
      useQuietReadRecovery(props);
    };
    let calls = 0;
    const error = new AppError("http", 429, "RATE_LIMITED", 61000);
    const props = {
      error: error as unknown,
      fetching: false,
      enabled: true,
      retry: () => {
        calls++;
      },
    };
    render(props);
    t.mock.timers.tick(59999);
    assert.equal(calls, 0);
    render({ ...props, enabled: false });
    t.mock.timers.tick(1);
    await Promise.resolve();
    assert.equal(calls, 0);
    render(props);
    render({
      ...props,
      retry: () => {
        calls += 10;
      },
    });
    t.mock.timers.tick(1000);
    await Promise.resolve();
    assert.equal(
      calls,
      10,
      "the pending timer must call the latest read callback",
    );
    render({ ...props, error: new AppError("network") });
    t.mock.timers.tick(9999);
    await Promise.resolve();
    assert.equal(calls, 10);
    render({ ...props, fetching: true });
    t.mock.timers.tick(60000);
    await Promise.resolve();
    assert.equal(calls, 10);
    render({ ...props, error: new AppError("http", 403) });
    t.mock.timers.tick(60000);
    await Promise.resolve();
    assert.equal(calls, 10);
    render({ ...props, error: undefined });
    render({ ...props, error: new AppError("network") });
    t.mock.timers.tick(5000);
    await Promise.resolve();
    assert.equal(calls, 11);
    cleanup?.();
  } finally {
    cleanup?.();
    delete local.cache[filename];
    context.restore();
  }
});
