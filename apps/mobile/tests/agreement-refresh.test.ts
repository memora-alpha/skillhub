import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("agreement reads pause on background/blur, avoid overlapping reads, and stop at session expiry", async (t) => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/hooks/use-agreement-refresh.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-agreement-refresh.ts");
  let enterFocus: () => (() => void) | undefined = () => undefined;
  let changeState: (state: string) => void = () => {};
  let reads = 0,
    removed = 0,
    current = true;
  let finishRead: (() => void) | undefined;
  const state = {
    currentState: "active",
    addEventListener: (_event: string, change: typeof changeState) => {
      changeState = change;
      return {
        remove: () => {
          removed++;
        },
      };
    },
  };
  const contexts = [
    mock.module(pathToFileURL(local.resolve("react")), {
      namedExports: { useCallback: (fn: unknown) => fn },
    }),
    mock.module(pathToFileURL(local.resolve("expo-router")), {
      namedExports: {
        useFocusEffect: (fn: typeof enterFocus) => {
          enterFocus = fn;
        },
      },
    }),
    mock.module(pathToFileURL(local.resolve("react-native")), {
      namedExports: { AppState: state },
    }),
  ];
  t.mock.timers.enable({ apis: ["setTimeout"] });
  delete local.cache[filename];
  const { useAgreementRefresh } = local(filename) as {
    useAgreementRefresh: (
      read: () => Promise<unknown>,
      enabled: boolean,
      isCurrent: () => boolean,
    ) => void;
  };
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  const read = async () => {
    reads++;
    await new Promise<void>((resolve) => {
      finishRead = resolve;
    });
  };
  const background = (value: string) => {
    state.currentState = value;
    changeState(value);
  };
  try {
    useAgreementRefresh(read, false, () => current);
    assert.equal(enterFocus(), undefined);
    useAgreementRefresh(read, true, () => current);
    const cleanup = enterFocus();
    assert.ok(cleanup);
    t.mock.timers.tick(30000);
    assert.equal(reads, 1);
    background("background");
    background("active");
    t.mock.timers.tick(60000);
    assert.equal(reads, 1);
    finishRead!();
    await flush();
    background("background");
    t.mock.timers.tick(30000);
    assert.equal(reads, 1);
    background("active");
    t.mock.timers.tick(30000);
    assert.equal(reads, 2);
    finishRead!();
    await flush();
    current = false;
    t.mock.timers.tick(30000);
    assert.equal(reads, 2);
    cleanup();
    assert.equal(removed, 1);
    current = true;
    const secondCleanup = enterFocus();
    assert.ok(secondCleanup);
    secondCleanup();
    t.mock.timers.tick(60000);
    assert.equal(reads, 2);
  } finally {
    delete local.cache[filename];
    for (const context of contexts.reverse()) context.restore();
  }
});
