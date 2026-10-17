// Source-backed wallet GET only. All accounts/HTTP responses are synthetic.
import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { AppError } from "../src/lib/http/errors";
import { createHttpClient, type HttpClient } from "../src/lib/http/client";
import { parseWalletSnapshot } from "../src/features/wallet/schemas/wallet-contracts";
import { createWalletApi } from "../src/features/wallet/api/wallet-api";
import {
  createWalletRuntime,
  noWalletCapabilities,
} from "../src/features/wallet/context/wallet-runtime";
import {
  walletReadOptions,
  projectWalletRead,
} from "../src/features/wallet/utils/wallet-query";
import { startWalletFixture } from "./fixtures/wallet-api";
import {
  walletModels,
  walletOwners,
  malformedCreditExamples,
} from "./fixtures/wallet-model";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const protocol = (error: unknown) =>
  error instanceof AppError && error.kind === "protocol";
const sessionError = (error: unknown) =>
  error instanceof AppError && error.kind === "session";
function setup(client: Pick<HttpClient, "request">, enabled = true) {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let current = true;
  const runtime = createWalletRuntime({
    scope: { ownerId: walletOwners.a, generation: 1 },
    queries,
    current: () => current,
    capabilities: { ...noWalletCapabilities, wallet: enabled },
  });
  const options = walletReadOptions(runtime, client);
  return {
    queries,
    runtime,
    options,
    end: () => {
      current = false;
      runtime.dispose();
    },
  };
}
const clientFor = (request: HttpClient["request"]) => ({ request });

test("Wallet schema accepts only exact source fields/units without invented owner or scale", () => {
  assert.deepEqual(parseWalletSnapshot(walletModels.a), walletModels.a);
  assert.deepEqual(
    parseWalletSnapshot(walletModels.absent),
    walletModels.absent,
  );
  const large = {
    availableCredit: "9007199254740993.01",
    heldCredit: "0.01",
    walletVersion: 0,
  };
  assert.deepEqual(parseWalletSnapshot(large), large);
  assert.deepEqual(
    parseWalletSnapshot({
      ...large,
      ownerId: "ignored",
      privateExtra: "discard",
    }),
    large,
  );
});
test("Wallet schema rejects malformed/missing Credit and invalid versions; never fabricates zero", () => {
  for (const field of ["availableCredit", "heldCredit"])
    for (const value of [...malformedCreditExamples, "-1.00"])
      assert.throws(
        () => parseWalletSnapshot({ ...walletModels.a, [field]: value }),
        protocol,
      );
  for (const version of [
    -1,
    0.1,
    "1",
    null,
    undefined,
    Number.MAX_SAFE_INTEGER + 1,
    Infinity,
    NaN,
  ])
    assert.throws(
      () => parseWalletSnapshot({ ...walletModels.a, walletVersion: version }),
      protocol,
    );
  for (const value of [
    null,
    [],
    {},
    { availableCredit: "0.00", walletVersion: 0 },
  ])
    assert.throws(() => parseWalletSnapshot(value), protocol);
});
test("Wallet adapter uses shared authenticated GET, exact signal and no mutation/owner parameters", async () => {
  const controller = new AbortController();
  let calls = 0;
  const api = createWalletApi(
    clientFor(async (path, options) => {
      calls++;
      assert.equal(path, "/me/wallet");
      assert.deepEqual(options, {
        method: "GET",
        authenticated: true,
        signal: controller.signal,
      });
      return walletModels.a;
    }),
  );
  assert.deepEqual(await api.read(controller.signal), walletModels.a);
  assert.equal(calls, 1);
  await assert.rejects(
    createWalletApi(clientFor(async () => undefined)).read(controller.signal),
    protocol,
  );
});
test("Actual shared HTTP envelope + loopback authorized zero are distinct from denied/malformed/error", async () => {
  const fixture = await startWalletFixture();
  let actor = "absent";
  const client = createHttpClient(() => fixture.url);
  client.bindSession({
    generation: 1,
    getToken: async () => "fixture-" + actor,
    renew: async () => {},
    expire: async () => {},
  });
  const api = createWalletApi(client);
  try {
    assert.deepEqual(
      await api.read(new AbortController().signal),
      walletModels.absent,
    );
    actor = "a";
    assert.deepEqual(
      await api.read(new AbortController().signal),
      walletModels.a,
    );
    fixture.failNext(503);
    await assert.rejects(
      api.read(new AbortController().signal),
      (e: unknown) => e instanceof AppError && e.status === 503,
    );
    fixture.deny("a");
    await assert.rejects(
      api.read(new AbortController().signal),
      (e: unknown) => e instanceof AppError && e.status === 403,
    );
    assert(
      fixture.events.every(
        (e) => e.method === "GET" && e.path === "/api/v1/me/wallet",
      ),
    );
  } finally {
    await fixture.close();
  }
});
test("Home/Wallet observers share one in-flight read and one accepted projection", async () => {
  const pending = deferred<unknown>();
  let calls = 0;
  const { queries, runtime, options, end } = setup(
    clientFor(async () => {
      calls++;
      return pending.promise;
    }),
  );
  const home = new QueryObserver(queries, options),
    wallet = new QueryObserver(queries, options);
  const stopHome = home.subscribe(() => {}),
    stopWallet = wallet.subscribe(() => {});
  try {
    assert.equal(
      projectWalletRead(runtime, home.getCurrentResult()).status,
      "loading",
    );
    assert.equal(calls, 1);
    const done = wallet.refetch({ cancelRefetch: false });
    pending.resolve(walletModels.a);
    await done;
    assert.equal(calls, 1);
    assert.deepEqual(
      projectWalletRead(runtime, home.getCurrentResult()).data,
      walletModels.a,
    );
    assert.deepEqual(
      projectWalletRead(runtime, home.getCurrentResult()),
      projectWalletRead(runtime, wallet.getCurrentResult()),
    );
  } finally {
    stopHome();
    stopWallet();
    end();
    queries.clear();
  }
});
test("Refresh overlap dedupes; transient failure retains same-owner snapshot marked stale", async () => {
  let next: () => Promise<unknown> = async () => walletModels.a;
  let calls = 0;
  const { queries, runtime, options, end } = setup(
    clientFor(async () => {
      calls++;
      return next();
    }),
  );
  const observer = new QueryObserver(queries, options),
    stop = observer.subscribe(() => {});
  try {
    await observer.refetch({ cancelRefetch: false });
    const pending = deferred<unknown>();
    next = () => pending.promise;
    const one = observer.refetch({ cancelRefetch: false }),
      two = observer.refetch({ cancelRefetch: false });
    assert.equal(calls, 2);
    assert.equal(
      projectWalletRead(runtime, observer.getCurrentResult()).status,
      "refreshing",
    );
    pending.reject(new AppError("http", 503));
    await Promise.all([one, two]);
    const state = projectWalletRead(runtime, observer.getCurrentResult());
    assert.equal(state.status, "refresh-error");
    assert.equal(state.stale, true);
    assert.deepEqual(state.data, walletModels.a);
    next = async () => walletModels.zero;
    await observer.refetch({ cancelRefetch: false });
    assert.equal(
      projectWalletRead(runtime, observer.getCurrentResult()).status,
      "ready",
    );
    assert.deepEqual(
      projectWalletRead(runtime, observer.getCurrentResult()).data,
      walletModels.zero,
    );
  } finally {
    stop();
    end();
    queries.clear();
  }
});
test("403/404 physically evict accepted money from the shared query; later error cannot revive it", async () => {
  for (const status of [403, 404]) {
    let next: () => Promise<unknown> = async () => walletModels.a;
    const { queries, runtime, options, end } = setup(clientFor(() => next()));
    const observer = new QueryObserver(queries, options),
      stop = observer.subscribe(() => {});
    try {
      await observer.refetch({ cancelRefetch: false });
      next = async () => {
        throw new AppError("http", status);
      };
      await observer.refetch({ cancelRefetch: false });
      assert(
        !JSON.stringify(queries.getQueryData(options.queryKey)).includes(
          "123.45",
        ),
      );
      next = async () => {
        throw new AppError("network");
      };
      await observer.refetch({ cancelRefetch: false });
      assert.equal(
        projectWalletRead(runtime, observer.getCurrentResult()).data,
        undefined,
      );
      assert.equal(
        projectWalletRead(runtime, observer.getCurrentResult()).status,
        status === 403 ? "denied" : "not-found",
      );
      next = async () => walletModels.b;
      await observer.refetch({ cancelRefetch: false });
      assert.deepEqual(
        projectWalletRead(runtime, observer.getCurrentResult()).data,
        walletModels.b,
      );
    } finally {
      stop();
      end();
      queries.clear();
    }
  }
});
test("Missing/malformed initial response is an error, disabled cached data remains unavailable", async () => {
  for (const response of [
    undefined,
    {},
    { ...walletModels.a, availableCredit: 0 },
  ]) {
    const { queries, runtime, options, end } = setup(
      clientFor(async () => response),
    );
    const observer = new QueryObserver(queries, options),
      stop = observer.subscribe(() => {});
    await observer.refetch({ cancelRefetch: false });
    assert.equal(
      projectWalletRead(runtime, observer.getCurrentResult()).status,
      "error",
    );
    assert.equal(
      projectWalletRead(runtime, observer.getCurrentResult()).data,
      undefined,
    );
    stop();
    end();
    queries.clear();
  }
  let calls = 0;
  const { queries, runtime, options, end } = setup(
    clientFor(async () => {
      calls++;
      return walletModels.a;
    }),
    false,
  );
  queries.setQueryData(options.queryKey, () => ({
    kind: "snapshot" as const,
    snapshot: parseWalletSnapshot(walletModels.a),
  }));
  const observer = new QueryObserver(queries, options),
    stop = observer.subscribe(() => {});
  assert.equal(options.enabled, false);
  assert.equal(
    projectWalletRead(runtime, observer.getCurrentResult()).status,
    "unavailable",
  );
  assert.equal(calls, 0);
  stop();
  end();
  queries.clear();
  assert.equal(
    projectWalletRead(null, { data: undefined, error: null, isFetching: false })
      .status,
    "unavailable",
  );
});
test("Retired A accepted cache is immediately hidden and late ignored-abort work cannot populate B", async () => {
  const pending = deferred<unknown>();
  const { queries, runtime, options, end } = setup(
    clientFor(() => pending.promise),
  );
  const read = queries.fetchQuery(options);
  const rejected = assert.rejects(read);
  end();
  const nextRuntime = createWalletRuntime({
    scope: { ownerId: walletOwners.b, generation: 2 },
    queries,
    current: () => true,
    capabilities: { ...noWalletCapabilities, wallet: true },
  });
  const nextOptions = walletReadOptions(
    nextRuntime,
    clientFor(async () => walletModels.b),
  );
  await queries.fetchQuery(nextOptions);
  pending.resolve(walletModels.a);
  await rejected;
  assert.equal(
    projectWalletRead(runtime, {
      data: { kind: "snapshot", snapshot: parseWalletSnapshot(walletModels.a) },
      error: null,
      isFetching: false,
    }).status,
    "session-ended",
  );
  assert.equal(queries.getQueryData(options.queryKey), undefined);
  assert.deepEqual(queries.getQueryData(nextOptions.queryKey), {
    kind: "snapshot",
    snapshot: parseWalletSnapshot(walletModels.b),
  });
  assert.equal(runtime.isCurrent(), false);
  nextRuntime.dispose();
  queries.clear();
});
test("Adapter/query forwards cancellation; ignored abort cannot produce accepted current result", async () => {
  const pending = deferred<unknown>();
  let received!: AbortSignal;
  const { queries, runtime, options, end } = setup(
    clientFor(async (_path, o) => {
      received = o!.signal!;
      return pending.promise;
    }),
  );
  const read = queries.fetchQuery(options),
    rejected = assert.rejects(read);
  await queries.cancelQueries({ queryKey: options.queryKey });
  assert.equal(received.aborted, true);
  pending.resolve(walletModels.a);
  await rejected;
  assert.equal(queries.getQueryData(options.queryKey), undefined);
  end();
  assert.equal(runtime.isCurrent(), false);
  queries.clear();
});
test("Shared HTTP renews one GET safely; late A401 after generation switch neither renews nor expires B", async () => {
  const axios = (await import("axios")).default;
  let version = 1,
    renewals = 0,
    expirations = 0,
    sends = 0;
  const late = deferred<{ status: number; data: unknown }>();
  const http = axios.create({
    adapter: async (config) => {
      sends++;
      const response =
        sends <= 2
          ? {
              status: sends === 1 ? 401 : 200,
              data:
                sends === 1
                  ? { success: false, message: "UNAUTHORIZED" }
                  : { success: true, data: walletModels.a },
            }
          : await late.promise;
      return { ...response, statusText: "fixture", headers: {}, config };
    },
  });
  const client = createHttpClient(
    () => "http://127.0.0.1/fixture/api/v1",
    http,
  );
  client.bindSession({
    get generation() {
      return version;
    },
    getToken: async () => "fixture-token",
    renew: async () => {
      renewals++;
    },
    expire: async () => {
      expirations++;
    },
  });
  const api = createWalletApi(client);
  assert.deepEqual(
    await api.read(new AbortController().signal),
    walletModels.a,
  );
  assert.equal(renewals, 1);
  assert.equal(sends, 2);
  const old = api.read(new AbortController().signal),
    rejected = assert.rejects(old, sessionError);
  // Wait until token acquisition has dispatched the old request.
  while (sends < 3) await new Promise((resolve) => setImmediate(resolve));
  version++;
  late.resolve({
    status: 401,
    data: { success: false, message: "UNAUTHORIZED" },
  });
  await rejected;
  assert.equal(renewals, 1);
  assert.equal(expirations, 0);
});

test("Superseded wallet refresh cannot replace a newer success with a late403", async () => {
  const late = deferred<unknown>();
  let next: () => Promise<unknown> = async () => walletModels.a;
  const { queries, runtime, options, end } = setup(clientFor(() => next()));
  const observer = new QueryObserver(queries, options),
    stop = observer.subscribe(() => {});
  try {
    await observer.refetch({ cancelRefetch: false });
    next = () => late.promise;
    const older = observer.refetch();
    next = async () => walletModels.zero;
    await observer.refetch({ cancelRefetch: true });
    late.reject(new AppError("http", 403));
    await older;
    assert.equal(
      projectWalletRead(runtime, observer.getCurrentResult()).status,
      "ready",
    );
    assert.deepEqual(
      projectWalletRead(runtime, observer.getCurrentResult()).data,
      walletModels.zero,
    );
  } finally {
    stop();
    end();
    queries.clear();
  }
});
