import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  QueryClient,
  QueryClientProvider,
  skipToken,
} from "@tanstack/react-query";
import { fixtureId } from "./fixtures/learning-requests-data";

test("form queue mounts without missing-queryFn warning and survives invalidation without fetching", async () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/hooks/use-confirmed-form-share.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-confirmed-form-share.ts");
  const mocks = [
    mock.module(pathToFileURL(local.resolve("@/features/connections")).href, {
      namedExports: {
        useConnections: () => ({
          key: ["connections", "viewer", 2],
          isCurrent: () => true,
        }),
      },
    }),
    mock.module(pathToFileURL(local.resolve("./use-messages-api")).href, {
      namedExports: {
        useMessagesApi: () => ({
          send: () => {
            assert.fail("must not send on mount/invalidation");
          },
          delivery: () => {
            assert.fail("must not check on mount/invalidation");
          },
        }),
      },
    }),
  ];
  const errors: unknown[][] = [];
  const error = mock.method(console, "error", (...args: unknown[]) => {
    errors.push(args);
  });
  const cache = new QueryClient();
  try {
    delete local.cache[filename];
    const { useConfirmedFormShare } = local(
      filename,
    ) as typeof import("../src/features/messages/hooks/use-confirmed-form-share");
    function Probe() {
      return createElement("div", null, useConfirmedFormShare().pending.length);
    }
    assert.match(
      renderToString(
        createElement(
          QueryClientProvider,
          { client: cache },
          createElement(Probe),
        ),
      ),
      />0</,
    );
    const key = ["connections", "viewer", 2, "confirmed-form-deliveries"];
    const queued = [{ clientMessageId: "pending", state: "failed" }];
    cache.setQueryData(key, queued);
    await cache.invalidateQueries({ queryKey: ["connections", "viewer", 2] });
    assert.deepEqual(cache.getQueryData(key), queued);
    assert.equal(
      cache.getQueryCache().find({ queryKey: key })?.options.queryFn,
      skipToken,
    );
    assert.equal(
      errors.some((args) =>
        args.some((arg) => String(arg).includes("No queryFn")),
      ),
      false,
    );
  } finally {
    error.mock.restore();
    cache.clear();
    delete local.cache[filename];
    mocks.forEach((item) => item.restore());
  }
});

test("delivered cards invalidate the session inbox, groups and preview without touching another owner", async () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/hooks/use-confirmed-form-share.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-confirmed-form-share.ts");
  const base = ["connections", "viewer", 2];
  const conversationId = fixtureId(40);
  const cache = new QueryClient();
  let sends = 0;
  const mocks = [
    mock.module(pathToFileURL(local.resolve("@/features/connections")), {
      namedExports: {
        useConnections: () => ({ key: base, isCurrent: () => true }),
      },
    }),
    mock.module(pathToFileURL(local.resolve("./use-messages-api")), {
      namedExports: {
        useMessagesApi: () => ({
          send: async () => {
            sends++;
            return {
              deliveryStatus: "DELIVERED",
              message: { id: fixtureId(100) },
            };
          },
        }),
      },
    }),
  ];
  const keys = [
    [...base, "conversations", "activity-order-v1"],
    [...base, "conversations", "inbox"],
    [...base, "conversations", "preview", conversationId],
    [...base, "thread", conversationId],
    ["connections", "other-owner", 2, "conversations", "inbox"],
  ];
  try {
    for (const key of keys) {
      cache.setQueryDefaults(key, { staleTime: Infinity });
      cache.setQueryData(key, { unread: false });
    }
    delete local.cache[filename];
    const { useConfirmedFormShare } = local(
      filename,
    ) as typeof import("../src/features/messages/hooks/use-confirmed-form-share");
    let share!: ReturnType<typeof useConfirmedFormShare>;
    function Probe() {
      share = useConfirmedFormShare();
      return null;
    }
    renderToString(
      createElement(
        QueryClientProvider,
        { client: cache },
        createElement(Probe),
      ),
    );
    assert.equal(sends, 0);
    await share.publish(conversationId, "Confirmed schedule", fixtureId(90));
    assert.equal(sends, 1);
    for (const key of keys.slice(0, 4)) {
      assert.equal(cache.getQueryState(key)?.isInvalidated, true);
      assert.deepEqual(
        cache.getQueryData(key),
        { unread: false },
        "the sender does not invent recipient unread state",
      );
    }
    assert.equal(cache.getQueryState(keys[4]!)?.isInvalidated, false);
  } finally {
    cache.clear();
    delete local.cache[filename];
    mocks.reverse().forEach((item) => item.restore());
  }
});
