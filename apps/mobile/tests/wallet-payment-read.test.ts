import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { AppError } from "../src/lib/http/errors";
import { createHttpClient, type RequestOptions } from "../src/lib/http/client";
import { createPaymentApi } from "../src/features/wallet/api/payment-api";
import {
  paymentDetailKey,
  paymentListKey,
} from "../src/features/wallet/utils/payment-query-keys";
import {
  paymentReadOptions,
  projectPaymentRead,
  pausePaymentRead,
} from "../src/features/wallet/utils/payment-observer";
import {
  createWalletRuntime,
  noWalletCapabilities,
} from "../src/features/wallet/context/wallet-runtime";
import {
  paymentWire,
  paymentId,
  otherPaymentId,
  paymentSuccess,
  paymentFailure,
  startPaymentContractFixture,
} from "./fixtures/payment-api";
import { deferred } from "./fixtures/payment-observation-model";

export function paymentReadSetup(
  load: (signal?: AbortSignal) => Promise<unknown>,
  enabled = true,
) {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let current = true;
  const runtime = createWalletRuntime({
    scope: { ownerId: "synthetic-a", generation: 1 },
    queries,
    current: () => current,
    capabilities: {
      ...noWalletCapabilities,
      wallet: true,
      history: true,
      paymentStatus: enabled,
    },
  });
  const client = {
    request: async (_path: string, options?: RequestOptions) =>
      load(options?.signal),
  };
  const options = paymentReadOptions(runtime, client, paymentId, queries);
  const observer = new QueryObserver(queries, { ...options, enabled: false });
  const stop = observer.subscribe(() => {});
  return {
    queries,
    runtime,
    client,
    options,
    observer,
    state: () =>
      projectPaymentRead(runtime, paymentId, observer.getCurrentResult()),
    end: () => {
      current = false;
      runtime.dispose();
    },
    close: () => {
      stop();
      runtime.dispose();
      queries.clear();
    },
  };
}
test("detail uses only shared authenticated GET with exact signal and valid UUID/response ID", async () => {
  const signal = new AbortController().signal;
  const calls: { path: string; options?: RequestOptions }[] = [];
  const api = createPaymentApi({
    request: async (path, options) => {
      calls.push({ path, options });
      return paymentWire();
    },
  });
  assert.equal((await api.detail(paymentId, signal)).id, paymentId);
  assert.equal(calls[0]?.path, `/payments/${paymentId}`);
  assert.deepEqual(calls[0]?.options, {
    method: "GET",
    authenticated: true,
    signal,
  });
  await assert.rejects(api.detail("bad", signal));
  await assert.rejects(api.detail(otherPaymentId, signal));
  assert.equal(calls.length, 2);
});
test("detail/list keys bind owner, session, ID, status and chain, separate from ledger", () => {
  const scope = { ownerId: "a", generation: 1 };
  const key = paymentDetailKey(scope, paymentId);
  for (const other of [
    paymentDetailKey({ ...scope, generation: 2 }, paymentId),
    paymentDetailKey({ ...scope, ownerId: "b" }, paymentId),
    paymentDetailKey(scope, otherPaymentId),
    paymentListKey(scope, "PAID", 1),
  ])
    assert.notDeepEqual(key, other);
  assert.notDeepEqual(
    paymentListKey(scope, "PAID", 1),
    paymentListKey(scope, "PAID", 2),
  );
  assert.notDeepEqual(
    paymentListKey(scope, "PAID", 1),
    paymentListKey(scope, "REVIEW", 1),
  );
});
test("same-tick checks coalesce; accepted version and null suppression survive remount", async () => {
  let sends = 0,
    next: () => Promise<unknown> = () => late.promise;
  const late = deferred<unknown>();
  const setup = paymentReadSetup(async () => {
    sends++;
    return next();
  });
  try {
    const a = setup.observer.refetch({ cancelRefetch: false }),
      b = setup.observer.refetch({ cancelRefetch: false });
    assert.equal(sends, 1);
    late.resolve(paymentWire());
    await Promise.all([a, b]);
    next = async () => ({ ...paymentWire(), checkout: null });
    await setup.observer.refetch();
    next = async () => paymentWire();
    await setup.observer.refetch();
    assert.equal(setup.state().data?.checkout, null);
    const second = new QueryObserver(setup.queries, {
      ...setup.options,
      enabled: false,
    });
    assert.equal(
      projectPaymentRead(setup.runtime, paymentId, second.getCurrentResult())
        .data?.checkout,
      null,
    );
    next = async () => paymentWire("PAID", 2);
    await setup.observer.refetch();
    assert.equal(setup.state().data?.status, "PAID");
  } finally {
    setup.close();
  }
});
test("denial evicts projection/cache; errors and cancellation reversion cannot resurrect it", async () => {
  let next: () => Promise<unknown> = async () => paymentWire("PAID");
  const setup = paymentReadSetup(() => next());
  try {
    await setup.observer.refetch();
    for (const code of [403, 404]) {
      next = async () => {
        throw new AppError("http", code);
      };
      await setup.observer.refetch();
      assert.equal(setup.state().data, undefined);
      const old = deferred<unknown>();
      next = () => old.promise;
      const pending = setup.observer.refetch();
      await pausePaymentRead(setup.queries, setup.runtime, paymentId);
      old.resolve(paymentWire("PAID", 9));
      await pending;
      assert.equal(setup.state().data, undefined);
      next = async () => {
        throw new AppError("network");
      };
      await setup.observer.refetch();
      assert.equal(setup.state().status, code === 403 ? "denied" : "not-found");
      assert(
        !JSON.stringify(
          setup.queries.getQueryData(setup.options.queryKey),
        ).includes("creditAmount"),
      );
    }
  } finally {
    setup.close();
  }
});
test("pause/background cancels and late response cannot overwrite new result; session retirement clears cache", async () => {
  let captured: AbortSignal | undefined;
  const late = deferred<unknown>();
  let next: () => Promise<unknown> = () => late.promise;
  const setup = paymentReadSetup((signal) => {
    captured = signal;
    return next();
  });
  try {
    const old = setup.observer.refetch();
    await pausePaymentRead(setup.queries, setup.runtime, paymentId);
    assert(captured?.aborted);
    next = async () => paymentWire("REVIEW", 2);
    await setup.observer.refetch();
    late.resolve(paymentWire("PAID", 99));
    await old;
    assert.equal(setup.state().data?.status, "REVIEW");
    setup.end();
    assert.equal(setup.state().status, "session-ended");
    assert.equal(setup.queries.getQueryData(setup.options.queryKey), undefined);
  } finally {
    setup.close();
  }
});
test("stale failures/conflicts retain accepted status; unavailable never dispatches", async () => {
  let next: () => Promise<unknown> = async () => paymentWire();
  const setup = paymentReadSetup(() => next());
  try {
    await setup.observer.refetch();
    next = async () => paymentWire("PAID");
    await setup.observer.refetch();
    assert.equal(setup.state().issue, "conflict");
    assert.equal(setup.state().data?.status, "PENDING");
    next = async () => {
      throw new AppError("network");
    };
    await setup.observer.refetch();
    assert(setup.state().stale);
  } finally {
    setup.close();
  }
  let sends = 0;
  const disabled = paymentReadSetup(async () => {
    sends++;
    return paymentWire();
  }, false);
  try {
    await disabled.observer.refetch();
    assert.equal(sends, 0);
    assert.equal(disabled.state().status, "unavailable");
  } finally {
    disabled.close();
  }
});
test("loopback shared auth/envelope resolves owner detail and denial; zero mutations", async () => {
  const fixture = await startPaymentContractFixture(),
    client = createHttpClient(() => fixture.url);
  client.bindSession({
    generation: 1,
    getToken: async () => "fixture-only",
    renew: async () => {},
    expire: async () => {},
  });
  try {
    const api = createPaymentApi(client),
      signal = new AbortController().signal;
    fixture.respond(200, paymentSuccess(paymentWire("REVIEW")));
    assert.equal((await api.detail(paymentId, signal)).status, "REVIEW");
    fixture.respond(404, paymentFailure(404, "PAYMENT_NOT_FOUND"));
    await assert.rejects(
      api.detail(paymentId, signal),
      (e) => e instanceof AppError && e.status === 404,
    );
    assert(fixture.events.every((e) => e.method === "GET" && e.authorized));
  } finally {
    await fixture.close();
  }
});

test("A in-flight outcome cannot populate B scope even when transport ignores abort", async () => {
  for (const rejected of [false, true]) {
    const queries = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    let isA = true;
    const a = createWalletRuntime({
      scope: { ownerId: "a", generation: 1 },
      queries,
      current: () => isA,
      capabilities: { ...noWalletCapabilities, paymentStatus: true },
    });
    const late = deferred<unknown>(),
      clientA = { request: async () => late.promise },
      optionsA = paymentReadOptions(a, clientA, paymentId, queries);
    const observerA = new QueryObserver(queries, {
        ...optionsA,
        enabled: false,
      }),
      stopA = observerA.subscribe(() => {}),
      pending = observerA.refetch();
    isA = false;
    a.dispose();
    const b = createWalletRuntime({
        scope: { ownerId: "b", generation: 2 },
        queries,
        current: () => true,
        capabilities: { ...noWalletCapabilities, paymentStatus: true },
      }),
      optionsB = paymentReadOptions(
        b,
        { request: async () => paymentWire("REVIEW", 2) },
        paymentId,
        queries,
      );
    const observerB = new QueryObserver(queries, {
        ...optionsB,
        enabled: false,
      }),
      stopB = observerB.subscribe(() => {});
    await observerB.refetch();
    if (rejected) late.reject(new AppError("http", 401));
    else late.resolve(paymentWire("PAID", 999));
    await pending;
    assert.equal(
      projectPaymentRead(b, paymentId, observerB.getCurrentResult()).data
        ?.status,
      "REVIEW",
    );
    assert.equal(queries.getQueryData(optionsA.queryKey), undefined);
    stopA();
    stopB();
    b.dispose();
    queries.clear();
  }
});
