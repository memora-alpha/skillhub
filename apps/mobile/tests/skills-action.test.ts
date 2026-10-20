import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createMutationIntent } from "../src/features/skills/utils/mutation-intent";

type Action = {
  run: <T>(
    operation: string,
    body: unknown,
    execute: (key: string) => Promise<T>,
    done?: (value: T, refreshed: boolean | undefined) => void,
    refreshAfter?: boolean | "background",
  ) => Promise<T | undefined>;
  pending: boolean;
  error: unknown;
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Run the actual hook with controllable focus/session and synchronous state slots.
// This exposes double taps before React renders and completions after navigation.
function harness(platform = "android") {
  const slots: unknown[] = [];
  let cursor = 0,
    keys = 0,
    refreshes = 0,
    current = true;
  let refresh = async () => true;
  let enterFocus!: () => () => void;
  let leaveFocus!: () => void;
  let back!: () => boolean;
  const toasts: { message: string; tone: string }[] = [];
  const exports: {
    useSkillAction?: (options?: {
      notifySuccess?: boolean;
      canAct?: () => boolean;
    }) => Action;
  } = {};
  const source = readFileSync(
    new URL(
      "../src/features/skills/hooks/use-skill-action.ts",
      import.meta.url,
    ),
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
    require: (name: string) => {
      if (name === "react")
        return {
          useCallback: (fn: unknown) => fn,
          useRef: (value: unknown) => {
            const index = cursor++;
            return (slots[index] ??= { current: value });
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
        };
      if (name === "react-native")
        return {
          Platform: { OS: platform },
          BackHandler: {
            addEventListener: (_event: string, handler: () => boolean) => {
              back = handler;
              return { remove() {} };
            },
          },
        };
      if (name === "expo-router")
        return {
          useFocusEffect: (fn: typeof enterFocus) => {
            enterFocus = fn;
          },
        };
      if (name === "expo-crypto") return { randomUUID: () => `key-${++keys}` };
      if (name === "../utils/mutation-intent") return { createMutationIntent };
      if (name === "../utils/skill-errors")
        return { skillError: () => "Không thực hiện được thao tác." };
      if (name === "@/providers/ToastProvider")
        return {
          useToast: () => ({
            showToast: (message: string, tone: string) =>
              toasts.push({ message, tone }),
          }),
        };
      if (name === "../context/SkillsProvider")
        return {
          useSkills: () => ({
            isCurrent: () => current,
            refresh: () => {
              refreshes++;
              return refresh();
            },
          }),
        };
      throw new Error(`Unexpected hook dependency: ${name}`);
    },
  });
  const render = (options?: {
    notifySuccess?: boolean;
    canAct?: () => boolean;
  }) => {
    cursor = 0;
    return exports.useSkillAction!(options);
  };
  render();
  leaveFocus = enterFocus();
  return {
    render,
    toasts,
    blur: () => leaveFocus(),
    focus: () => {
      leaveFocus = enterFocus();
    },
    changeSession: () => {
      current = false;
    },
    setRefresh: (next: typeof refresh) => {
      refresh = next;
    },
    refreshes: () => refreshes,
    back: () => back?.() ?? false,
  };
}

test("skill action synchronously locks double taps and Android back until completion", async () => {
  const view = harness(),
    write = deferred<string>();
  let calls = 0;
  const action = view.render();
  const execute = () => {
    calls++;
    return write.promise;
  };
  const first = action.run("create", { skillId: "skill" }, execute);
  await action.run("create", { skillId: "skill" }, execute);
  assert.equal(calls, 1);
  assert.equal(view.render().pending, true);
  assert.equal(view.back(), true);
  write.resolve("saved");
  await first;
  assert.equal(view.render().pending, false);
  assert.equal(view.back(), false);
});

test("web skill actions complete without registering unsupported hardware Back", async () => {
  const view = harness("web");
  assert.equal(view.back(), false);
  assert.equal(
    await view.render().run("read", null, async () => "ok", undefined, false),
    "ok",
  );
});

test("ambiguous retry retains key/body while changed payload starts a new intent", async () => {
  const view = harness();
  const keys: string[] = [];
  const fail = async (key: string) => {
    keys.push(key);
    throw new Error("network");
  };
  await view.render().run("create", { description: "draft" }, fail);
  await view.render().run("create", { description: "draft" }, fail);
  await view.render().run("create", { description: "changed" }, fail);
  assert.equal(keys[0], keys[1]);
  assert.notEqual(keys[1], keys[2]);
  assert.equal(view.refreshes(), 0);
});

test("committed write with partial refresh keeps success and invokes completion once", async () => {
  const view = harness();
  view.setRefresh(async () => false);
  let writes = 0,
    completions = 0;
  await view.render().run(
    "update",
    { expectedVersion: 1 },
    async () => {
      writes++;
      return "saved";
    },
    () => {
      completions++;
    },
  );
  const state = view.render();
  assert.equal(writes, 1);
  assert.equal(completions, 1);
  assert.equal(state.error, null);
  assert.equal(view.toasts.length, 1);
  assert.match(view.toasts[0]!.message, /Đã lưu\. Chưa cập nhật/);
  assert.equal(view.toasts[0]!.tone, "info");
});

test("late response after account change cannot refresh, notify, or navigate", async () => {
  const view = harness(),
    write = deferred<string>();
  let completions = 0;
  const pending = view.render().run(
    "update",
    {},
    () => write.promise,
    () => {
      completions++;
    },
  );
  view.changeSession();
  write.resolve("saved");
  await pending;
  assert.equal(view.refreshes(), 0);
  assert.equal(completions, 0);
  assert.equal(view.toasts.length, 0);
});

test("blur during refresh ignores callbacks and retains intent for safe retry on return", async () => {
  const view = harness(),
    refresh = deferred<boolean>();
  view.setRefresh(() => refresh.promise);
  const keys: string[] = [];
  let completions = 0;
  const execute = async (key: string) => {
    keys.push(key);
    return "saved";
  };
  const first = view
    .render()
    .run("submit", { fileIds: ["file"] }, execute, () => {
      completions++;
    });
  await Promise.resolve();
  view.blur();
  refresh.resolve(true);
  await first;
  assert.equal(completions, 0);
  view.focus();
  view.setRefresh(async () => true);
  await view.render().run("submit", { fileIds: ["file"] }, execute, () => {
    completions++;
  });
  assert.equal(keys[0], keys[1]);
  assert.equal(completions, 1);
});

test("private download read does not invalidate queries or report a successful write", async () => {
  const view = harness();
  await view
    .render()
    .run("download", null, async () => "opened", undefined, false);
  assert.equal(view.refreshes(), 0);
  assert.equal(view.toasts.length, 0);
});

test("custom success feedback avoids duplicate toasts while failures still notify", async () => {
  const view = harness();
  const action = view.render({ notifySuccess: false });
  await action.run("create", {}, async () => "saved");
  assert.equal(view.toasts.length, 0);
  await action.run("create", {}, async () => {
    throw new Error("failed");
  });
  assert.equal(view.toasts.length, 1);
  assert.equal(view.toasts[0]?.tone, "error");
});

test("late failure after leaving the screen cannot show a toast", async () => {
  const view = harness(),
    write = deferred<string>();
  const pending = view.render().run("update", {}, async () => {
    await write.promise;
    throw new Error("late failure");
  });
  view.blur();
  write.resolve("done");
  await pending;
  assert.equal(view.toasts.length, 0);
});

test("read denial blocks stale action callbacks and unlocks a pending action without completion", async () => {
  const view = harness(),
    write = deferred<string>();
  let allowed = true,
    completions = 0,
    executions = 0;
  const options = { canAct: () => allowed };
  const action = view.render(options);
  const pending = action.run(
    "download",
    null,
    () => write.promise,
    () => {
      completions++;
    },
    false,
  );
  allowed = false;
  write.resolve("downloaded");
  await pending;
  assert.equal(completions, 0);
  assert.equal(view.render(options).pending, false);
  await action.run("update", {}, async () => {
    executions++;
  });
  assert.equal(executions, 0);
  allowed = true;
  await view.render(options).run("update", {}, async () => {
    executions++;
  });
  assert.equal(executions, 1);
});

test("confirmed save completes and unlocks while read refresh is still pending", async () => {
  const view = harness();
  const refresh = deferred<boolean>();
  view.setRefresh(() => refresh.promise);
  let completion: { value: string; refreshed: boolean | undefined } | undefined;
  const pending = view.render({ notifySuccess: false }).run(
    "create",
    {},
    async () => "saved",
    (value, refreshed) => {
      completion = { value, refreshed };
    },
    "background",
  );
  await new Promise((resolve) => setImmediate(resolve));
  try {
    assert.deepEqual(completion, { value: "saved", refreshed: undefined });
    assert.equal(view.render().pending, false);
    assert.equal(view.back(), false);
    assert.equal(view.refreshes(), 1);
    assert.equal(view.toasts.length, 0);
  } finally {
    refresh.resolve(false);
  }
  assert.equal(await pending, "saved");
  assert.deepEqual(completion, { value: "saved", refreshed: undefined });
  assert.equal(view.toasts.length, 0);
});

test("a failed background read cannot turn a committed save into a mutation failure", async () => {
  const view = harness();
  view.setRefresh(async () => {
    throw new Error("read unavailable");
  });
  let completed = 0;
  await view.render().run(
    "create",
    {},
    async () => "saved",
    () => {
      completed++;
    },
    "background",
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(completed, 1);
  assert.equal(view.render().error, null);
  assert.equal(view.toasts.length, 1);
  assert.equal(view.toasts[0]?.tone, "success");
});
