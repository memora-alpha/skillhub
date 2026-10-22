import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { agreementPath } from "./fixtures/learning-agreement";

function harness() {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/hooks/use-agreement-navigation.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-agreement-navigation.ts");
  const path = agreementPath(),
    routes: unknown[] = [],
    updates: unknown[] = [];
  let focus: () => () => void = () => () => {};
  let current = true,
    reads = 0;
  let load: (signal?: AbortSignal) => Promise<unknown[]> = async () => [
    { id: path.id, conversationId: path.conversationId },
  ];
  const contexts = [
    mock.module(pathToFileURL(local.resolve("react")), {
      namedExports: {
        useRef: (value: unknown) => ({ current: value }),
        useState: (value: unknown) => [
          value,
          (next: unknown) => updates.push(next),
        ],
        useCallback: (value: unknown) => value,
      },
    }),
    mock.module(pathToFileURL(local.resolve("expo-router")), {
      namedExports: {
        useRouter: () => ({ push: (route: unknown) => routes.push(route) }),
        useFocusEffect: (value: typeof focus) => {
          focus = value;
        },
      },
    }),
    mock.module(pathToFileURL(local.resolve("@/features/connections")), {
      namedExports: { useConnections: () => ({ isCurrent: () => current }) },
    }),
    mock.module(pathToFileURL(local.resolve("./use-learning-paths-api")), {
      namedExports: {
        useLearningPathsApi: () => ({
          mine: (signal?: AbortSignal) => {
            reads++;
            return load(signal);
          },
        }),
      },
    }),
  ];
  delete local.cache[filename];
  const { useAgreementNavigation } = local(filename) as {
    useAgreementNavigation: (id: string) => { open: () => Promise<void> };
  };
  const navigation = useAgreementNavigation(path.conversationId);
  const leave = focus();
  return {
    path,
    routes,
    updates,
    navigation,
    leave,
    reads: () => reads,
    load: (fn: typeof load) => {
      load = fn;
    },
    expire: () => {
      current = false;
    },
    cleanup: () => {
      leave();
      delete local.cache[filename];
      for (const context of contexts.reverse()) context.restore();
    },
  };
}

test("Chat resolves one agreement directly without opening the personal list or entry screen", async () => {
  const h = harness();
  try {
    await h.navigation.open();
    assert.deepEqual(h.routes, [
      {
        pathname: "/paths/[id]",
        params: { id: h.path.id, fromConversation: h.path.conversationId },
      },
    ]);
    assert.equal(h.reads(), 1);
  } finally {
    h.cleanup();
  }
});

test("only empty or genuinely multiple conversation matches use the agreement entry", async () => {
  const h = harness();
  try {
    for (const rows of [
      [],
      [{ id: "unrelated", conversationId: "other" }],
      [
        { id: "a", conversationId: h.path.conversationId },
        { id: "b", conversationId: h.path.conversationId },
      ],
    ]) {
      h.load(async () => rows);
      await h.navigation.open();
      assert.deepEqual(h.routes.at(-1), {
        pathname: "/agreement-type",
        params: { conversationId: h.path.conversationId, mode: "api" },
      });
    }
  } finally {
    h.cleanup();
  }
});

test("failed or late agreement lookup cannot navigate after blur/logout or a repeated tap", async () => {
  const h = harness();
  try {
    h.load(async () => {
      throw new Error("lookup failed");
    });
    await h.navigation.open();
    assert.equal(h.routes.length, 0);
    assert.ok(h.updates.some((value) => value instanceof Error));
    let resolve: (rows: unknown[]) => void = () => {};
    let signal: AbortSignal | undefined;
    h.load(async (value) => {
      signal = value;
      return new Promise((done) => {
        resolve = done;
      });
    });
    const pending = h.navigation.open();
    await h.navigation.open();
    assert.equal(h.reads(), 2);
    h.leave();
    assert.equal(signal?.aborted, true);
    resolve([{ id: h.path.id, conversationId: h.path.conversationId }]);
    await pending;
    assert.equal(h.routes.length, 0);
  } finally {
    h.cleanup();
  }
  const expired = harness();
  try {
    expired.load(async () => {
      expired.expire();
      return [
        { id: expired.path.id, conversationId: expired.path.conversationId },
      ];
    });
    await expired.navigation.open();
    assert.equal(expired.routes.length, 0);
  } finally {
    expired.cleanup();
  }
});
