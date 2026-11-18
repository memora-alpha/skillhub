import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { QueryClient } from "@tanstack/react-query";
import type { OwnIdentity } from "../src/features/account";
import {
  fixtureIdentity,
  fixtureUsers,
} from "./fixtures/learning-requests-data";

test("title selection updates the account and self preview only, blocks duplicates and ignores stale session completions", async () => {
  const local = createRequire(
    new URL(
      "../src/features/achievements/hooks/use-achievements.ts",
      import.meta.url,
    ),
  );
  const client = new QueryClient();
  const account = fixtureIdentity(fixtureUsers[0]);
  let generation = 1,
    calls = 0;
  let complete!: (result: unknown) => void;
  let mutate!: (code: string | null) => Promise<unknown>;
  const runtime = {
    controller: {
      get generation() {
        return generation;
      },
      getSnapshot: () => "ready",
    },
    client: {
      request: async () => {
        calls++;
        return new Promise((resolve) => {
          complete = resolve;
        });
      },
    },
  };
  const contexts = Object.entries({
    react: {
      useMemo: (fn: () => unknown) => fn(),
      useCallback: (fn: unknown) => fn,
      useRef: (value: unknown) => ({ current: value }),
      useEffect() {},
    },
    "react-native": { AppState: { addEventListener: () => ({ remove() {} }) } },
    "expo-router": { useFocusEffect() {} },
    "@tanstack/react-query": {
      useQueryClient: () => client,
      useQuery: () => ({
        data: { selectedTitle: null, items: [] },
        refetch() {},
      }),
      useMutation: (options: { mutationFn: typeof mutate }) => {
        mutate = options.mutationFn;
        return { reset() {} };
      },
    },
    "@/features/auth": {
      useAuthSession: () => ({
        session: { userId: account.userId },
        runtime,
        status: "authenticated",
      }),
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const file = local.resolve("./use-achievements.ts");
  try {
    delete local.cache[file];
    const { useAchievements } = local(file);
    const key = ["achievements", account.userId, 1];
    const self = ["public-profile", account.userId, 1, account.userId],
      other = ["public-profile", account.userId, 1, fixtureUsers[1]!.id];
    client.setQueryData(key, { selectedTitle: null, items: [] });
    client.setQueryData(["account", "me", 1], account);
    client.setQueryData(self, {});
    client.setQueryData(other, {});
    useAchievements();
    const first = mutate("FIRST_PATH");
    await assert.rejects(mutate("FIVE_PATHS"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 1);
    complete({ selectedTitle: "First Path" });
    await first;
    assert.equal(
      client.getQueryData<{ selectedTitle: string }>(key)?.selectedTitle,
      "First Path",
    );
    assert.equal(
      client.getQueryData<OwnIdentity>(["account", "me", 1])?.profile
        .selectedTitle,
      "First Path",
    );
    assert.equal(client.getQueryState(self)?.isInvalidated, true);
    assert.equal(client.getQueryState(other)?.isInvalidated, false);
    const pending = mutate(null);
    await new Promise((resolve) => setImmediate(resolve));
    generation = 2;
    complete({ selectedTitle: null });
    await assert.rejects(pending);
    assert.equal(
      client.getQueryData<OwnIdentity>(["account", "me", 1])?.profile
        .selectedTitle,
      "First Path",
    );
  } finally {
    contexts.forEach((context) => context.restore());
    delete local.cache[file];
    client.clear();
  }
});
