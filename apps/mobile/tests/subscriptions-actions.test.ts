import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test, type TestContext } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";
import type { Membership } from "../src/features/subscriptions/api/subscription-contracts";
import { paidMembership } from "./fixtures/subscriptions";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function fixture(t: TestContext) {
  const local = createRequire(
    new URL(
      "../src/features/subscriptions/hooks/use-subscription-actions.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-subscription-actions.ts");
  let index = 0;
  const slots: { value: unknown }[] = [];
  let focused = true;
  let setup: (() => void | (() => void)) | undefined;
  let cleanup: (() => void) | undefined;
  let current = true;
  let changes = 0;
  let updates = 0;
  const pending = deferred<Membership>();
  const toasts: { message: string; tone: string }[] = [];
  const contexts = Object.entries({
    react: {
      useState: (initial: unknown) => {
        const slot = (slots[index++] ??= { value: initial });
        return [
          slot.value,
          (value: unknown) => {
            slot.value = value;
          },
        ];
      },
      useRef: (initial: unknown) =>
        (slots[index++] ??= { value: { current: initial } }).value,
      useCallback: (fn: unknown) => (slots[index++] ??= { value: fn }).value,
    },
    "expo-router": {
      useFocusEffect: (fn: () => void | (() => void)) => {
        if (setup === fn) return;
        cleanup?.();
        setup = fn;
        if (focused) cleanup = setup() || undefined;
      },
    },
    "@/features/connections": {
      useConnections: () => ({ isCurrent: () => current }),
    },
    "@/providers/ToastProvider": {
      useToast: () => ({
        showToast: (message: string, tone: string) =>
          toasts.push({ message, tone }),
      }),
    },
    "../context/subscriptions-provider": {
      useSubscriptions: () => ({
        api: {
          update: () => {
            updates++;
            return pending.promise;
          },
        },
        model: {},
        changed: () => {
          changes++;
        },
      }),
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  delete local.cache[filename];
  const { useSubscriptionActions } = local(
    filename,
  ) as typeof import("../src/features/subscriptions/hooks/use-subscription-actions");
  t.after(() => {
    cleanup?.();
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  });
  return {
    pending,
    toasts,
    get changes() {
      return changes;
    },
    get updates() {
      return updates;
    },
    render() {
      index = 0;
      return useSubscriptionActions(paidMembership);
    },
    blur() {
      focused = false;
      cleanup?.();
      cleanup = undefined;
    },
    focus() {
      focused = true;
      cleanup = setup?.() || undefined;
    },
    expire() {
      current = false;
    },
    startUpdate() {
      this.render().update(
        {
          expectedVersion: paidMembership.subscription!.version,
          autoRenew: false,
        },
        "Hủy tự động gia hạn?",
        "Dùng đến hết kỳ.",
      );
      return this.render().confirm();
    },
  };
}

test("renewal changes refresh the current account after leaving the screen, without showing a late toast", async (t) => {
  for (const outcome of ["success", "uncertain"] as const) {
    await t.test(outcome, async (t) => {
      const f = fixture(t);
      const request = f.startUpdate();
      f.blur();
      if (outcome === "success") f.pending.resolve(paidMembership);
      else f.pending.reject(new AppError("network"));
      await request;
      assert.equal(f.updates, 1);
      assert.equal(f.changes, 1);
      assert.deepEqual(f.toasts, []);
    });
  }
});

test("returning to the same screen does not show a result from its previous focus", async (t) => {
  const f = fixture(t);
  const request = f.startUpdate();
  f.blur();
  f.focus();
  f.pending.resolve(paidMembership);
  await request;
  assert.equal(f.changes, 1);
  assert.deepEqual(f.toasts, []);
  assert.equal(f.render().busy, false);
});

test("late renewal responses cannot refresh or notify a different session", async (t) => {
  const f = fixture(t);
  const request = f.startUpdate();
  f.expire();
  f.pending.resolve(paidMembership);
  await request;
  assert.equal(f.changes, 0);
  assert.deepEqual(f.toasts, []);
});

test("a focused renewal update sends once and reports its result with one toast", async (t) => {
  const f = fixture(t);
  const first = f.startUpdate();
  await f.render().confirm();
  f.pending.resolve(paidMembership);
  await first;
  assert.equal(f.updates, 1);
  assert.equal(f.changes, 1);
  assert.equal(f.toasts.length, 1);
  assert.equal(f.toasts[0]?.tone, "success");
});
