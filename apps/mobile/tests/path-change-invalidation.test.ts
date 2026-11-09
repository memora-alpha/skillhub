import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { QueryClient } from "@tanstack/react-query";
import { terminationFixture } from "./fixtures/path-changes-data";

test("a peer cancellation update invalidates mine pages in the current session only", async () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/hooks/use-path-changes.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-path-changes.ts");
  const cache = new QueryClient();
  const request = terminationFixture();
  const base = ["connections", "owner", 2];
  const keys = [
    [...base, "learning-paths", "mine"],
    [...base, "learning-paths", "mine", "pages"],
    [...base, "learning-paths", request.pathId],
    [...base, "learning-paths", "another-path"],
    ["connections", "another-owner", 2, "learning-paths", "mine", "pages"],
    ["connections", "owner", 1, "learning-paths", "mine", "pages"],
  ];
  const effects: (() => void)[] = [];
  const runtime = { key: base, isCurrent: () => true, call: async () => [] };
  const mocks = {
    react: {
      useMemo: (factory: () => unknown) => factory(),
      useEffect: (effect: () => void) => effects.push(effect),
    },
    "expo-router": { useIsFocused: () => true },
    "@tanstack/react-query": { useQueryClient: () => cache },
    "@/features/connections": {
      useConnections: () => runtime,
      useConnectionQuery: () => ({ data: [request] }),
    },
    "@/features/wallet": { useRefreshWallet: () => () => {} },
    "./use-agreement-refresh": { useAgreementRefresh: () => {} },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useTerminationRequests } = local(filename);
    keys.forEach((key) => cache.setQueryData(key, "snapshot"));
    useTerminationRequests(request.pathId);
    effects.forEach((effect) => effect());
    assert.deepEqual(
      keys.map((key) => cache.getQueryState(key)?.isInvalidated),
      [true, true, true, false, false, false],
    );
    keys.forEach((key) => cache.setQueryData(key, "snapshot"));
    runtime.isCurrent = () => false;
    effects.forEach((effect) => effect());
    assert.ok(keys.every((key) => !cache.getQueryState(key)?.isInvalidated));
  } finally {
    cache.clear();
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
