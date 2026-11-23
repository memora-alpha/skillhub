import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";
import type { RedemptionStatus } from "../src/features/rewards/api/reward-contracts";

const id = "11111111-1111-4111-8111-111111111111";
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

async function withRefresh(
  run: (h: ReturnType<typeof harness>) => Promise<void>,
) {
  const local = createRequire(
    new URL("../src/features/rewards/hooks/use-rewards.ts", import.meta.url),
  );
  const filename = local.resolve("./use-rewards.ts");
  const refreshFile = local.resolve("./use-redemption-refresh.ts");
  const h = harness();
  const mocks = Object.entries(h.modules).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    delete local.cache[refreshFile];
    const { useRedemption } = local(
      filename,
    ) as typeof import("../src/features/rewards/hooks/use-rewards");
    h.mount(() => useRedemption(h.routeId));
    await run(h);
  } finally {
    h.unmount();
    delete local.cache[filename];
    delete local.cache[refreshFile];
    mocks.reverse().forEach((context) => context.restore());
  }
}

function harness() {
  let cleanup: (() => void) | undefined;
  let dependencies: unknown[] | undefined;
  let slot = 0;
  const refs: { current: unknown }[] = [];
  const listeners = new Set<(state: string) => void>();
  let mounted = true;
  let renderHook = () => {};
  let readQuery: (signal: AbortSignal) => Promise<{ status: RedemptionStatus }>;
  const h = {
    focused: true,
    authenticated: true,
    current: true,
    routeId: id,
    reads: 0,
    query: {
      data: { status: "ISSUING" as RedemptionStatus } as
        { status: RedemptionStatus } | undefined,
      isFetching: false,
      error: undefined as unknown,
      refetch: async (options?: { cancelRefetch?: boolean }) => {
        assert.equal(options?.cancelRefetch, false);
        h.query.isFetching = true;
        h.render();
        try {
          h.query.data = await readQuery(new AbortController().signal);
          h.query.error = undefined;
        } catch (error) {
          h.query.error = error;
        } finally {
          h.query.isFetching = false;
          h.render();
        }
      },
    },
    read: async (): Promise<{ status: RedemptionStatus }> => {
      h.reads++;
      return { status: "ISSUING" };
    },
    render() {
      if (mounted) {
        slot = 0;
        renderHook();
      }
    },
    mount(render: () => void) {
      renderHook = render;
      h.render();
    },
    unmount() {
      mounted = false;
      cleanup?.();
    },
    appState: {
      currentState: "active",
      addEventListener: (_name: string, fn: (state: string) => void) => {
        listeners.add(fn);
        return { remove: () => listeners.delete(fn) };
      },
    },
    background(state: string) {
      h.appState.currentState = state;
      [...listeners].forEach((listener) => listener(state));
    },
    modules: {} as Record<string, Record<string, unknown>>,
  };
  const isCurrent = () => h.current;
  h.modules = {
    react: {
      useRef: (initial: unknown) =>
        refs[slot++] ?? (refs[slot - 1] = { current: initial }),
      useEffect: (effect: () => (() => void) | undefined, next: unknown[]) => {
        if (
          !dependencies ||
          next.some((value, i) => !Object.is(value, dependencies![i]))
        ) {
          cleanup?.();
          dependencies = next;
          cleanup = effect();
        }
      },
    },
    "react-native": { AppState: h.appState },
    "expo-router": { useIsFocused: () => h.focused },
    "@/features/connections": {
      useConnections: () => ({ enabled: h.authenticated, isCurrent }),
      useConnectionQuery: (_key: unknown, read: typeof readQuery) => {
        readQuery = read;
        return h.query;
      },
      useConnectionList: () => ({}),
    },
    "../context/rewards-provider": {
      useRewards: () => ({
        api: {
          receipt: async (resourceId: string, signal: AbortSignal) => {
            assert.equal(resourceId, id);
            assert.ok(signal instanceof AbortSignal);
            return h.read();
          },
        },
      }),
    },
  };
  return h;
}

test("receipt polls pending status then stops for every completed outcome", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const status of [
    "ISSUED",
    "FAILED_REFUNDED",
    "REFUNDED_MANUAL",
  ] as const) {
    await withRefresh(async (h) => {
      h.read = async () => {
        h.reads++;
        return { status };
      };
      t.mock.timers.tick(9999);
      assert.equal(h.reads, 0);
      t.mock.timers.tick(1);
      await flush();
      assert.equal(h.reads, 1);
      assert.equal(h.query.data?.status, status);
      t.mock.timers.tick(120000);
      await flush();
      assert.equal(h.reads, 1);
    });
  }
});

test("receipt refresh pauses on background/blur and ends on session change or unmount", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  await withRefresh(async (h) => {
    h.background("background");
    t.mock.timers.tick(30000);
    assert.equal(h.reads, 0);
    h.background("active");
    t.mock.timers.tick(10000);
    await flush();
    assert.equal(h.reads, 1);
    h.focused = false;
    h.render();
    t.mock.timers.tick(30000);
    assert.equal(h.reads, 1);
    h.focused = true;
    h.render();
    h.current = false;
    t.mock.timers.tick(30000);
    assert.equal(h.reads, 1);
    h.current = true;
    h.unmount();
    t.mock.timers.tick(30000);
    assert.equal(h.reads, 1);
  });
});

test("receipt refresh does not overlap slow reads or start with missing data, invalid routes or inactive session", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  await withRefresh(async (h) => {
    h.query.data = undefined;
    h.render();
    t.mock.timers.tick(30000);
    assert.equal(h.reads, 0);
    h.query.data = { status: "ISSUING" };
    h.routeId = "invalid";
    h.render();
    t.mock.timers.tick(30000);
    assert.equal(h.reads, 0);
    h.routeId = id;
    h.authenticated = false;
    h.render();
    t.mock.timers.tick(30000);
    assert.equal(h.reads, 0);
    let finish!: () => void;
    h.read = async () => {
      h.reads++;
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return { status: "ISSUING" };
    };
    h.authenticated = true;
    h.render();
    t.mock.timers.tick(10000);
    assert.equal(h.reads, 1);
    t.mock.timers.tick(120000);
    assert.equal(h.reads, 1);
    finish();
    await flush();
    t.mock.timers.tick(10000);
    assert.equal(h.reads, 2);
    h.background("background");
    finish();
    await flush();
    t.mock.timers.tick(30000);
    assert.equal(h.reads, 2);
  });
});

test("manual review polls more slowly; rate limits delay reads and permission errors stop them", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  await withRefresh(async (h) => {
    h.query.data = { status: "MANUAL_REVIEW" };
    h.render();
    t.mock.timers.tick(29999);
    assert.equal(h.reads, 0);
    t.mock.timers.tick(1);
    await flush();
    assert.equal(h.reads, 1);
    h.query.data = { status: "ISSUING" };
    h.query.error = new AppError("http", 429, "", Date.now() + 60000);
    h.render();
    t.mock.timers.tick(59999);
    assert.equal(h.reads, 1);
    t.mock.timers.tick(1);
    await flush();
    assert.equal(h.reads, 2);
    h.query.error = new AppError("http", 403);
    h.render();
    t.mock.timers.tick(120000);
    assert.equal(h.reads, 2);
  });
});

test("a transient network failure recovers on the next read without another debit", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  await withRefresh(async (h) => {
    h.read = async () => {
      h.reads++;
      if (h.reads === 1) throw new AppError("network");
      return { status: "ISSUED" };
    };
    t.mock.timers.tick(10000);
    await flush();
    assert.equal(h.reads, 1);
    assert.equal(h.query.data?.status, "ISSUING");
    assert.ok(h.query.error instanceof AppError);
    t.mock.timers.tick(10000);
    await flush();
    assert.equal(h.reads, 2);
    assert.equal(h.query.data?.status, "ISSUED");
    assert.equal(h.query.error, undefined);
    t.mock.timers.tick(120000);
    assert.equal(h.reads, 2);
  });
});
