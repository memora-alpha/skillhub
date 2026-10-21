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
