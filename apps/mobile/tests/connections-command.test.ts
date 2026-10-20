import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  CommandIntent,
  isConnectionPolicyUnavailable,
  isRejectedCommand,
} from "../src/lib/http/command-intent";
import { AppError } from "../src/lib/http/errors";

type Action = {
  run: <T>(
    fingerprint: string,
    send: (key: string) => Promise<T>,
  ) => Promise<T | undefined>;
  retry: () => Promise<unknown>;
  pending: boolean;
  error: unknown;
  uncertain: boolean;
  originalError: unknown;
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Execute the real hook with controllable React state and session dependencies.
function harness(dev = true) {
  const slots: unknown[] = [],
    effects: (() => void)[] = [],
    logs: unknown[][] = [];
  let cursor = 0,
    keys = 0,
    refreshes = 0;
  const makeRuntime = () => {
    let current = true;
    return {
      key: ["connections", "fixture-user", keys],
      isCurrent: () => current,
      assertCurrent: () => {
        if (!current) throw new AppError("session");
      },
      expire: () => {
        current = false;
      },
    };
  };
  let runtime = makeRuntime();
  const exports: { useConnectionCommand?: () => Action } = {};
  const source = readFileSync(
    new URL("../src/features/connections/hooks.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  runInNewContext(outputText, {
    exports,
    __DEV__: dev,
    console: { warn: (...args: unknown[]) => logs.push(args) },
    require: (name: string) => {
      if (name === "react")
        return {
          useRef: (value: unknown) => {
            const i = cursor++;
            return (slots[i] ??= { current: value });
          },
          useState: (value: unknown) => {
            const i = cursor++;
            if (!(i in slots)) slots[i] = value;
            return [
              slots[i],
              (next: unknown) => {
                slots[i] = next;
              },
            ];
          },
          useEffect: (effect: () => void, deps: unknown[]) => {
            const i = cursor++,
              previous = slots[i] as unknown[] | undefined;
            if (!previous || deps.some((dep, j) => dep !== previous[j])) {
              slots[i] = deps;
              effects.push(effect);
            }
          },
        };
      if (name === "@tanstack/react-query")
        return {
          useQueryClient: () => ({
            invalidateQueries: async () => {
              refreshes++;
            },
          }),
        };
      if (name === "expo-crypto") return { randomUUID: () => `key-${++keys}` };
      if (name === "./runtime") return { useConnections: () => runtime };
      if (name === "@/lib/http/command-intent")
        return {
          CommandIntent,
          isConnectionPolicyUnavailable,
          isRejectedCommand,
        };
      if (name === "@/lib/http/errors") return { AppError };
      if (
        ["react-native", "expo-router", "@/lib/http/read-access"].includes(name)
      )
        return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const render = () => {
    cursor = 0;
    const action = exports.useConnectionCommand!();
    effects.splice(0).forEach((effect) => effect());
    return action;
  };
  render();
  return {
    render,
    logs,
    refreshes: () => refreshes,
    changeSession: () => {
      runtime.expire();
      runtime = makeRuntime();
      render();
    },
  };
}

test("uncertain proposal submission retries the original callback/key after changed form input is blocked", async () => {
  const h = harness(),
    firstError = new AppError("network");
  const originalBody = JSON.stringify({
    message: "Tôi có thể dạy bạn",
    proposedCredit: "20.00",
  });
  const calls: { key: string; body: string }[] = [];
  const send = async (key: string) => {
    calls.push({ key, body: originalBody });
    if (calls.length === 1) throw firstError;
    return { id: "saved-proposal" };
  };
  await h.render().run(originalBody, send);
  assert.equal(h.render().uncertain, true);
  assert.equal(h.render().originalError, firstError);
  assert.equal(calls.length, 1); // Failure and rerender never replay a mutation.
  await h.render().run("changed-credit-200", async () => {
    assert.fail("must not send edited payload");
  });
  assert.equal(
    (h.render().error as AppError).code,
    "COMMAND_RECONCILE_REQUIRED",
  );
  assert.equal(h.render().originalError, firstError);
  assert.deepEqual(await h.render().retry(), { id: "saved-proposal" });
  assert.deepEqual(calls, [
    { key: "key-1", body: originalBody },
    { key: "key-1", body: originalBody },
  ]);
  assert.equal(h.render().uncertain, false);
  assert.equal(h.render().originalError, undefined);
  assert.equal(h.refreshes(), 1);
});

test("a rejected replay cannot clear the unknown original outcome or replace its key", async () => {
  const h = harness(),
    firstError = new AppError("http", 503);
  const keys: string[] = [];
  await h.render().run("original", async (key) => {
    keys.push(key);
    if (keys.length === 1) throw firstError;
    if (keys.length === 2) throw new AppError("http", 404);
    return "saved";
  });
  await h.render().retry();
  assert.equal(h.render().uncertain, true);
  assert.equal(h.render().originalError, firstError);
  assert.equal((h.render().error as AppError).status, 404);
  assert.equal(await h.render().retry(), "saved");
  assert.deepEqual(keys, ["key-1", "key-1", "key-1"]);
});

test("a definite first rejection allows a corrected proposal with a new key", async () => {
  const h = harness(),
    keys: string[] = [];
  await h.render().run("invalid", async (key) => {
    keys.push(key);
    throw new AppError("http", 400, "INVALID_CREDIT_HINT");
  });
  assert.equal(h.render().uncertain, false);
  assert.equal(await h.render().retry(), undefined);
  assert.equal(
    await h.render().run("corrected", async (key) => {
      keys.push(key);
      return "saved";
    }),
    "saved",
  );
  assert.deepEqual(keys, ["key-1", "key-2"]);
});

test("synchronous pending guard prevents duplicate retry taps", async () => {
  const h = harness(),
    result = deferred<string>();
  let calls = 0;
  await h.render().run("original", async () => {
    calls++;
    if (calls === 1) throw new AppError("protocol");
    return result.promise;
  });
  const retry = h.render().retry();
  await h.render().retry();
  assert.equal(h.render().pending, true);
  assert.equal(calls, 2);
  result.resolve("saved");
  assert.equal(await retry, "saved");
  assert.equal(h.render().pending, false);
});

test("session changes discard recovery and ignore late completion from the previous account", async () => {
  const h = harness(),
    result = deferred<string>();
  await h.render().run("old-account", async () => {
    throw new AppError("network");
  });
  h.changeSession();
  assert.equal(h.render().uncertain, false);
  assert.equal(h.render().originalError, undefined);
  assert.equal(await h.render().retry(), undefined);
  const pending = h.render().run("another-account", async () => result.promise);
  h.changeSession();
  result.resolve("old-account-result");
  assert.equal(await pending, undefined);
  assert.equal(h.refreshes(), 0);
  assert.equal(h.render().uncertain, false);
});

test("development diagnostics contain only error kind/status/code and production does not log", async () => {
  const h = harness();
  await h.render().run("private-body-and-token", async () => {
    throw new AppError("http", 503, "CONNECTION_POLICY_UNAVAILABLE");
  });
  assert.deepEqual(JSON.parse(JSON.stringify(h.logs)), [
    [
      "[connections] command failed",
      {
        kind: "http",
        status: 503,
        code: "CONNECTION_POLICY_UNAVAILABLE",
      },
    ],
  ]);
  const production = harness(false);
  await production.render().run("private-body", async () => {
    throw new Error("private server response");
  });
  assert.equal(production.logs.length, 0);
});

test("missing connection policy is a definite rejection so optional hints can be corrected", async () => {
  const h = harness(),
    keys: string[] = [];
  await h.render().run("with-session-count", async (key) => {
    keys.push(key);
    throw new AppError("http", 503, "CONNECTION_POLICY_UNAVAILABLE");
  });
  assert.equal(h.render().uncertain, false);
  assert.equal(h.render().originalError, undefined);
  assert.equal(
    (h.render().error as AppError).code,
    "CONNECTION_POLICY_UNAVAILABLE",
  );
  assert.equal(await h.render().retry(), undefined);
  assert.equal(
    await h.render().run("without-session-count", async (key) => {
      keys.push(key);
      return "saved";
    }),
    "saved",
  );
  assert.deepEqual(keys, ["key-1", "key-2"]);
});

test("policy rejection during exact-key replay resolves a previously unknown outcome", async () => {
  const h = harness(),
    keys: string[] = [];
  await h.render().run("original", async (key) => {
    keys.push(key);
    if (keys.length === 1) throw new AppError("network");
    throw new AppError("http", 503, "CONNECTION_POLICY_UNAVAILABLE");
  });
  assert.equal(h.render().uncertain, true);
  await h.render().retry();
  assert.deepEqual(keys, ["key-1", "key-1"]);
  assert.equal(h.render().uncertain, false);
  assert.equal(h.render().originalError, undefined);
  assert.equal(
    await h.render().run("corrected", async (key) => {
      keys.push(key);
      return "saved";
    }),
    "saved",
  );
  assert.deepEqual(keys, ["key-1", "key-1", "key-2"]);
});

test("only the exact HTTP policy rejection clears intent; other 5xx outcomes stay unknown", () => {
  for (const error of [
    new AppError("http", 503),
    new AppError("http", 503, "OTHER_ERROR"),
    new AppError("http", 500, "CONNECTION_POLICY_UNAVAILABLE"),
    new AppError("network", 503, "CONNECTION_POLICY_UNAVAILABLE"),
  ]) {
    assert.equal(isConnectionPolicyUnavailable(error), false);
    const intent = new CommandIntent();
    intent.begin("original", () => "key-1");
    intent.failed(error);
    assert.throws(() => intent.begin("corrected", () => "key-2"), AppError);
  }
  const intent = new CommandIntent();
  intent.begin("original", () => "key-1");
  intent.failed(new AppError("http", 503, "CONNECTION_POLICY_UNAVAILABLE"));
  assert.equal(
    intent.begin("corrected", () => "key-2"),
    "key-2",
  );
});
