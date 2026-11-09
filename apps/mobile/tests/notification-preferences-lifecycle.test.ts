import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { QueryClient } from "@tanstack/react-query";
import { AppError } from "../src/lib/http/errors";

test("preferences mutation scopes cache to the owner, cancels old reads and discards a late response after logout", async () => {
  const local = createRequire(
    new URL(
      "../src/features/settings/hooks/use-notification-preferences.ts",
      import.meta.url,
    ),
  );
  const cache = new QueryClient();
  const queryKey = ["connections", "owner", 4, "notification-preferences"];
  let current = true;
  let complete!: (value: unknown) => void;
  let calls = 0;
  let mutation!: (patch: unknown) => Promise<unknown>;
  let cancels = 0;
  const originalCancel = cache.cancelQueries.bind(cache);
  cache.cancelQueries = async (...args) => {
    cancels++;
    return originalCancel(...args);
  };
  const runtime = {
    key: queryKey.slice(0, -1),
    isCurrent: () => current,
    assertCurrent: () => {
      if (!current) throw new AppError("session");
    },
    call: async () => {
      calls++;
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
  };
  const contexts = Object.entries({
    react: {
      useMemo: (fn: () => unknown) => fn(),
      useRef: (value: unknown) => ({ current: value }),
    },
    "@tanstack/react-query": {
      useQueryClient: () => cache,
      useMutation: (options: {
        mutationFn: typeof mutation;
        retry: boolean;
      }) => {
        assert.equal(options.retry, false);
        mutation = options.mutationFn;
        return {};
      },
    },
    "@/features/connections": {
      useConnections: () => runtime,
      useConnectionQuery: () => ({}),
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const filename = local.resolve("./use-notification-preferences.ts");
  try {
    delete local.cache[filename];
    local(filename).useNotificationPreferences();
    const pending = mutation({ learning: false });
    await new Promise((resolve) => setImmediate(resolve));
    await assert.rejects(mutation({ learning: true }), AppError);
    assert.equal(calls, 1);
    complete({ learning: false, credit: true, community: true });
    await pending;
    assert.deepEqual(cache.getQueryData(queryKey), {
      learning: false,
      credit: true,
      community: true,
    });
    assert.equal(cancels, 2);
    assert.equal(
      cache.getQueryData([
        "connections",
        "other",
        4,
        "notification-preferences",
      ]),
      undefined,
    );

    const late = mutation({ credit: false });
    await new Promise((resolve) => setImmediate(resolve));
    current = false;
    cache.removeQueries({ queryKey });
    complete({ learning: false, credit: false, community: true });
    await assert.rejects(
      late,
      (error) => error instanceof AppError && error.kind === "session",
    );
    assert.equal(cache.getQueryData(queryKey), undefined);
    await assert.rejects(mutation({ learning: true }), AppError);
    assert.equal(calls, 2);
  } finally {
    contexts.forEach((context) => context.restore());
    delete local.cache[filename];
    cache.clear();
  }
});
