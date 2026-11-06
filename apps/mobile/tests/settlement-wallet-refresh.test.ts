import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { QueryClient } from "@tanstack/react-query";

test("settlement refresh invalidates only wallet reads owned by the current login generation", async () => {
  const local = createRequire(
    new URL(
      "../src/features/wallet/hooks/use-refresh-wallet.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-refresh-wallet.ts");
  const cache = new QueryClient();
  const keys = [
    ["wallet", "owner", 1, "balance"],
    ["wallet", "owner", 1, "history"],
    ["wallet", "owner", 0, "history"],
    ["wallet", "another-owner", 1, "history"],
  ];
  const runtime = { key: ["wallet", "owner", 1], isCurrent: () => true };
  const mocks = {
    react: { useCallback: (callback: unknown) => callback },
    "@tanstack/react-query": { useQueryClient: () => cache },
    "../context/WalletProvider": { useOptionalWalletRuntime: () => runtime },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useRefreshWallet } = local(filename) as {
      useRefreshWallet: () => () => Promise<unknown> | undefined;
    };
    keys.forEach((key) => cache.setQueryData(key, "server-balance"));
    await useRefreshWallet()();
    assert.deepEqual(
      keys.map((key) => cache.getQueryState(key)?.isInvalidated),
      [true, true, false, false],
    );
    cache.clear();
    keys.forEach((key) => cache.setQueryData(key, "server-balance"));
    runtime.isCurrent = () => false;
    await useRefreshWallet()();
    assert.ok(keys.every((key) => !cache.getQueryState(key)?.isInvalidated));
    assert.ok(
      keys.every((key) => cache.getQueryData(key) === "server-balance"),
    );
  } finally {
    cache.clear();
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
