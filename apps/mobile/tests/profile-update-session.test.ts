import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { QueryClient } from "@tanstack/react-query";
import { AppError } from "../src/lib/http/errors";
import {
  fixtureIdentity,
  fixtureUsers,
} from "./fixtures/learning-requests-data";

test("profile saves cannot dispatch from an old screen or repopulate account cache after a session change", async () => {
  const local = createRequire(
    new URL("../src/features/auth/context/AuthSession.tsx", import.meta.url),
  );
  const cache = new QueryClient();
  const account = fixtureIdentity(fixtureUsers[0]);
  let generation = 1;
  let calls = 0;
  let complete!: (value: unknown) => void;
  let mutate!: (patch: unknown) => Promise<unknown>;
  const auth = {
    account,
    runtime: {
      controller: {
        get generation() {
          return generation;
        },
        getSnapshot: () => "ready",
      },
      accountApi: {
        updateProfile: async () => {
          calls++;
          return new Promise((resolve) => {
            complete = resolve;
          });
        },
      },
    },
  };
  const noop = () => {};
  const contexts = Object.entries({
    react: {
      createContext: () => ({}),
      useContext: () => auth,
      useCallback: noop,
      useEffect: noop,
      useMemo: noop,
      useState: noop,
      useSyncExternalStore: noop,
    },
    "@tanstack/react-query": {
      useQuery: noop,
      useQueryClient: () => cache,
      useMutation: (options: { mutationFn: typeof mutate; retry: boolean }) => {
        assert.equal(options.retry, false);
        mutate = options.mutationFn;
      },
    },
    "@/lib/storage/auth-token-store": { createAuthTokenStore: noop },
    "../hooks/use-avatar-monitor": { useAvatarMonitor: noop },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const filename = local.resolve("./AuthSession.tsx");
  try {
    delete local.cache[filename];
    const { useUpdateProfile } = local(filename);
    useUpdateProfile();
    generation = 2;
    await assert.rejects(mutate({ locale: "en" }), AppError);
    assert.equal(calls, 0);

    generation = 1;
    cache.setQueryData(["account", "me", 1], account);
    const pending = mutate({ timezone: "Asia/Tokyo" });
    await new Promise((resolve) => setImmediate(resolve));
    generation = 2;
    cache.removeQueries({ queryKey: ["account"] });
    complete({ ...account.profile, timezone: "Asia/Tokyo" });
    await assert.rejects(pending, AppError);
    assert.equal(cache.getQueryData(["account", "me", 1]), undefined);

    useUpdateProfile();
    cache.setQueryData(["account", "me", 2], account);
    const saved = mutate({ locale: "en" });
    await new Promise((resolve) => setImmediate(resolve));
    complete({ ...account.profile, locale: "en" });
    await saved;
    assert.equal(
      cache.getQueryData<typeof account>(["account", "me", 2])?.profile.locale,
      "en",
    );
  } finally {
    contexts.forEach((context) => context.restore());
    delete local.cache[filename];
    cache.clear();
  }
});
