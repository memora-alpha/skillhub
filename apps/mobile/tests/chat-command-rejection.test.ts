import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";
import { fixtureId } from "./fixtures/learning-requests-data";

test("a terminal moderation rejection unlocks an uncertain command, while permission failures keep reconciliation", async () => {
  const local = createRequire(
    new URL("../src/features/connections/hooks.ts", import.meta.url),
  );
  const filename = local.resolve("./hooks.ts");
  const slots: unknown[] = [];
  let cursor = 0,
    nextId = 80;
  const runtime = {
    key: ["fixture"],
    isCurrent: () => true,
    assertCurrent() {},
  };
  const noop = () => {};
  const mocks = {
    react: {
      useRef: (value: unknown) => {
        const index = cursor++;
        slots[index] ??= { current: value };
        return slots[index];
      },
      useState: (value: unknown) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = value;
        return [
          slots[index],
          (next: unknown) => {
            slots[index] = next;
          },
        ];
      },
      useEffect: noop,
      useMemo: noop,
      useCallback: noop,
    },
    "react-native": { AppState: {} },
    "expo-router": { useFocusEffect: noop },
    "expo-crypto": { randomUUID: () => fixtureId(nextId++) },
    "@tanstack/react-query": {
      useQuery: noop,
      useInfiniteQuery: noop,
      useQueryClient: () => ({ invalidateQueries: async () => {} }),
    },
    "./runtime": { useConnections: () => runtime },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const previousDev = Object.getOwnPropertyDescriptor(globalThis, "__DEV__");
  Object.defineProperty(globalThis, "__DEV__", {
    value: false,
    configurable: true,
  });
  try {
    delete local.cache[filename];
    const { useConnectionCommand } = local(
      filename,
    ) as typeof import("../src/features/connections/hooks");
    const render = () => {
      cursor = 0;
      return useConnectionCommand();
    };
    const ids: string[] = [];
    let failure = new AppError(
      "http",
      503,
      "CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE",
    );
    const send = async (id: string) => {
      ids.push(id);
      throw failure;
    };
    await render().run("original", send);
    assert.equal(render().uncertain, true);
    failure = new AppError("http", 403, "FORBIDDEN");
    await render().retry();
    assert.equal(render().uncertain, true);
    failure = new AppError("http", 422, "CONTENT_MODERATION_BLOCKED");
    await render().retry();
    assert.equal(render().uncertain, false);
    assert.equal(
      (render().error as AppError).code,
      "CONTENT_MODERATION_BLOCKED",
    );
    assert.equal(new Set(ids).size, 1);
    let replacementId: string | undefined;
    assert.equal(
      await render().run("edited", async (id) => {
        replacementId = id;
        return "sent";
      }),
      "sent",
    );
    assert.notEqual(replacementId, ids[0]);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
    if (previousDev) Object.defineProperty(globalThis, "__DEV__", previousDev);
    else Reflect.deleteProperty(globalThis, "__DEV__");
  }
});
