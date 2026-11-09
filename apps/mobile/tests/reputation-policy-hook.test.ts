import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test, type TestContext } from "node:test";
import { pathToFileURL } from "node:url";
import type { Reputation } from "../src/features/community/api/community-api";
import { AppError } from "../src/lib/http/errors";
import { fixtureId } from "./fixtures/learning-requests-data";

function snapshot(): Reputation {
  return {
    reputationScore: 25,
    level: "LOW",
    activeRestrictions: [
      {
        scope: "CREATE_NEW_ACTIVITY",
        reasonCode: "LOW_REPUTATION",
        endsAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    policyNotice: ["Quy tắc cần xác nhận"],
    items: [],
    nextCursor: null,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function load(t: TestContext) {
  const local = createRequire(
    new URL(
      "../src/features/community/hooks/use-reputation-policy.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-reputation-policy.ts");
  let index = 0;
  const slots: {
    deps?: unknown[];
    value?: unknown;
    cleanup?: () => void;
    setup?: () => void | (() => void);
    focus?: boolean;
  }[] = [];
  const equal = (a?: unknown[], b?: unknown[]) =>
    !!a &&
    !!b &&
    a.length === b.length &&
    a.every((v, i) => Object.is(v, b[i]));
  function memo(factory: () => unknown, deps: unknown[]) {
    const slot = (slots[index++] ??= {});
    if (!equal(slot.deps, deps)) {
      slot.value = factory();
      slot.deps = deps;
    }
    return slot.value;
  }
  function effect(
    setup: () => void | (() => void),
    deps: unknown[],
    focus = false,
  ) {
    const slot = (slots[index++] ??= {});
    if (!equal(slot.deps, deps)) {
      slot.cleanup?.();
      slot.setup = setup;
      slot.cleanup = setup() || undefined;
      slot.deps = deps;
      slot.focus = focus;
    }
  }
  let current = true;
  const makeRuntime = (userId = fixtureId(1)) => ({
    key: ["connections", userId, 1],
    isCurrent: () => current,
  });
  let runtime = makeRuntime();
  let backend = snapshot(),
    posts = 0,
    reads = 0;
  const invalidations: unknown[] = [];
  let dataUpdateCount = 1;
  let fetchMeta: { fetchMore: { direction: "forward" } } | null = null;
  let read = async () => backend;
  let post = async () => {
    backend = { ...backend, policyNotice: null, activeRestrictions: [] };
  };
  const query = {
    data: { pages: [backend], pageParams: [undefined] },
    error: undefined as unknown,
    isFetching: false,
    isLoading: false,
    refetch: async () => {
      reads++;
      fetchMeta = null;
      try {
        const value = await read();
        query.data = { pages: [value], pageParams: [undefined] };
        dataUpdateCount++;
        query.error = undefined;
        return { data: query.data, error: undefined };
      } catch (error) {
        query.error = error;
        throw error;
      }
    },
  };
  const contexts = Object.entries({
    react: {
      useMemo: memo,
      useCallback: (fn: () => unknown, deps: unknown[]) => memo(() => fn, deps),
      useEffect: effect,
      useState: (initial: unknown) => {
        const slot = (slots[index++] ??= { value: initial });
        return [
          slot.value,
          (next: unknown) => {
            slot.value = typeof next === "function" ? next(slot.value) : next;
          },
        ];
      },
    },
    "expo-router": {
      useFocusEffect: (fn: () => void | (() => void)) => effect(fn, [fn], true),
    },
    "react-native": { AppState: { currentState: "active" } },
    "@tanstack/react-query": {
      useQueryClient: () => ({
        getQueryState: () => ({ dataUpdateCount, fetchMeta }),
        invalidateQueries: async (selection: unknown) => {
          invalidations.push(selection);
        },
      }),
    },
    "@/features/connections": { useConnections: () => runtime },
    "./use-community": {
      useCommunityApi: () => ({
        acknowledgePolicy: async () => {
          posts++;
          await post();
          return { acknowledged: true };
        },
      }),
      useReputation: () => query,
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  delete local.cache[filename];
  const { useReputationPolicy } = local(
    filename,
  ) as typeof import("../src/features/community/hooks/use-reputation-policy");
  t.after(() => {
    slots.forEach((slot) => slot.cleanup?.());
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  });
  return {
    query,
    invalidations,
    render(enabled = true) {
      index = 0;
      return useReputationPolicy(enabled);
    },
    blur() {
      slots
        .filter((s) => s.focus)
        .forEach((s) => {
          s.cleanup?.();
          s.cleanup = undefined;
        });
    },
    focus() {
      slots
        .filter((s) => s.focus)
        .forEach((s) => {
          s.cleanup = s.setup?.() || undefined;
        });
    },
    expire() {
      current = false;
    },
    switchOwner() {
      current = false;
      runtime = {
        key: ["connections", fixtureId(2), 2],
        isCurrent: () => true,
      };
    },
    readWith(fn: typeof read) {
      read = fn;
    },
    postWith(fn: typeof post) {
      post = fn;
    },
    backend(value: Reputation) {
      backend = value;
    },
    appendHistory() {
      dataUpdateCount++;
      fetchMeta = { fetchMore: { direction: "forward" } };
      query.error = undefined;
    },
    get posts() {
      return posts;
    },
    get reads() {
      return reads;
    },
  };
}

test("mount and refresh never acknowledge; explicit confirmation locks duplicate taps and rereads server state", async (t) => {
  const h = load(t),
    released = deferred<void>();
  h.postWith(async () => {
    await released.promise;
    h.backend({ ...snapshot(), policyNotice: null, activeRestrictions: [] });
  });
  const first = h.render();
  assert.equal(h.posts, 0);
  await first.refresh();
  assert.equal(h.posts, 0);
  const action = h.render().acknowledge();
  await h.render().acknowledge();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(h.posts, 1);
  assert.equal(h.render().pending, true);
  released.resolve();
  await action;
  const result = h.render();
  assert.equal(result.acknowledged, true);
  assert.equal(result.pending, false);
  assert.equal(result.data?.activeRestrictions.length, 0);
  assert.deepEqual(h.invalidations, [
    {
      queryKey: ["connections", fixtureId(1), 1, "reputation"],
      refetchType: "none",
    },
  ]);
});

test("a successful acknowledgement followed by a read error keeps its receipt and retries only the read", async (t) => {
  const h = load(t);
  let afterPost = false;
  h.postWith(async () => {
    afterPost = true;
  });
  h.readWith(async () => {
    if (afterPost) throw new AppError("network");
    return snapshot();
  });
  await h.render().acknowledge();
  assert.equal(h.render().acknowledged, true);
  assert.ok(h.render().error);
  await h.render().acknowledge();
  assert.equal(h.posts, 1);
  h.readWith(async () => ({ ...snapshot(), policyNotice: null }));
  await h.render().refresh();
  assert.equal(h.posts, 1);
  assert.equal(
    h.render().data?.activeRestrictions.length,
    1,
    "remaining time/other restrictions do not disappear on acknowledgement",
  );
});

test("an unknown POST outcome requires a fresh check and never automatically repeats confirmation", async (t) => {
  const h = load(t);
  h.postWith(async () => {
    throw new AppError("network");
  });
  await h.render().acknowledge();
  assert.equal(h.render().needsCheck, true);
  await h.render().acknowledge();
  assert.equal(h.posts, 1);
  h.backend({ ...snapshot(), policyNotice: null, activeRestrictions: [] });
  await h.render().refresh();
  assert.equal(h.render().needsCheck, false);
  assert.equal(h.posts, 1);
});

test("a later automatic read requiring the same policy clears the old receipt and allows a new explicit confirmation", async (t) => {
  const h = load(t);
  await h.render().acknowledge();
  assert.equal(h.render().acknowledged, true);
  assert.equal(h.posts, 1);
  h.backend(snapshot());
  await h.query.refetch();
  const required = h.render();
  assert.equal(required.acknowledged, false);
  assert.equal(h.posts, 1, "GET/focus must not send a policy acceptance");
  await required.acknowledge();
  assert.equal(h.posts, 2);
  assert.equal(h.render().acknowledged, true);
});

test("after a successful POST and failed refresh, cached policy preserves the receipt until a successful GET, even with identical data", async (t) => {
  const h = load(t);
  let sent = false;
  h.postWith(async () => {
    sent = true;
  });
  h.readWith(async () => {
    if (sent) throw new AppError("network");
    return snapshot();
  });
  await h.render().acknowledge();
  assert.equal(h.render().acknowledged, true);
  assert.ok(h.render().error);
  await h.render().acknowledge();
  assert.equal(h.posts, 1);
  h.appendHistory();
  assert.equal(
    h.render().acknowledged,
    true,
    "pagination does not refresh the cached policy on the first page",
  );
  h.readWith(async () => h.query.data.pages[0]!);
  await h.query.refetch();
  const checked = h.render();
  assert.equal(checked.acknowledged, false);
  assert.equal(checked.error, undefined);
  assert.equal(h.posts, 1);
});

test("changed/cleared policy or failed preflight never posts stale acceptance", async (t) => {
  const h = load(t);
  h.readWith(async () => ({ ...snapshot(), policyNotice: ["Quy tắc mới"] }));
  await h.render().acknowledge();
  assert.equal(h.posts, 0);
  h.readWith(async () => {
    throw new AppError("http", 403);
  });
  await h.render().acknowledge();
  assert.equal(h.posts, 0);
});

test("blur and refocus during preflight invalidate the old click, without leaving pending stuck", async (t) => {
  const h = load(t),
    delayed = deferred<Reputation>();
  h.readWith(() => delayed.promise);
  const action = h.render().acknowledge();
  h.blur();
  h.focus();
  delayed.resolve(snapshot());
  await action;
  assert.equal(h.posts, 0);
  assert.equal(h.render().pending, false);
  const delayedRead = deferred<Reputation>();
  h.readWith(() => delayedRead.promise);
  const refresh = h.render().refresh();
  h.blur();
  delayedRead.resolve(snapshot());
  await refresh;
  h.focus();
  assert.equal(h.render().pending, false);
});

test("closing the gate or ending a session during preflight prevents POST; a new owner has no old receipt", async (t) => {
  const h = load(t),
    delayed = deferred<Reputation>();
  h.readWith(() => delayed.promise);
  const action = h.render().acknowledge();
  h.render(false);
  delayed.resolve(snapshot());
  await action;
  assert.equal(h.posts, 0);
  h.readWith(async () => snapshot());
  const old = h.render();
  h.expire();
  await old.acknowledge();
  assert.equal(h.posts, 0);
  h.switchOwner();
  assert.equal(h.render().acknowledged, false);
  assert.equal(h.render().pending, false);
});

test("a late acknowledgement from an old session cannot update the new owner's state or cache", async (t) => {
  const h = load(t),
    delayed = deferred<void>();
  const started = deferred<void>();
  h.postWith(() => {
    started.resolve();
    return delayed.promise;
  });
  const action = h.render().acknowledge();
  await started.promise;
  assert.equal(h.posts, 1);
  h.switchOwner();
  h.render();
  delayed.resolve();
  await action;
  assert.equal(h.render().acknowledged, false);
  assert.equal(h.invalidations.length, 0);
});

test("reaching the restriction deadline refreshes state once without submitting any acknowledgement", async (t) => {
  t.mock.timers.enable({
    apis: ["setTimeout", "Date"],
    now: Date.parse("2026-11-08T00:00:00Z"),
  });
  const h = load(t);
  const data = snapshot();
  data.activeRestrictions[0]!.endsAt = "2026-11-08T00:00:01Z";
  h.query.data.pages = [data];
  h.render();
  t.mock.timers.tick(2001);
  await Promise.resolve();
  assert.equal(h.reads, 1);
  assert.equal(h.posts, 0);
});
