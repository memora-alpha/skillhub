import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  createWalletRuntime,
  noWalletCapabilities,
} from "../src/features/wallet/context/wallet-runtime";
import {
  walletScopeKey,
  walletQueryKey,
} from "../src/features/wallet/utils/wallet-query-keys";
import { createReadAccess } from "./fixtures/wallet-read-access";
import { AppError } from "../src/lib/http/errors";
import { createHttpClient } from "../src/lib/http/client";
import { startWalletFixture } from "./fixtures/wallet-api";
import { walletModels, walletOwners } from "./fixtures/wallet-model";
import { attachPaymentPreparation } from "./fixtures/wallet-preparation";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const scope = { ownerId: walletOwners.a, generation: 1 };
function setup() {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let current = true;
  const runtime = createWalletRuntime({
    scope,
    queries,
    current: () => current,
    capabilities: { ...noWalletCapabilities, wallet: true },
  });
  return {
    queries,
    runtime,
    end: () => {
      current = false;
      runtime.dispose();
    },
  };
}

test("session-owned preparation survives screen remount and reconnect without dispatch; retirement clears private state", async () => {
  const { runtime, queries, end } = setup();
  const preparation = attachPaymentPreparation(runtime);
  preparation.model.edit("2000");
  preparation.model.review();
  let calls = 0,
    captured: unknown;
  let signal!: AbortSignal;
  const gate = deferred<unknown>();
  const pending = preparation.model.confirmModel((intent, options) => {
    calls++;
    captured = intent;
    signal = options.signal;
    return gate.promise;
  });
  // A second screen attaches to the same session-owned preparation, not a new model.
  assert.equal(attachPaymentPreparation(runtime), preparation);
  const detach = preparation.model.subscribe(() => {});
  detach();
  await queries.refetchQueries({ type: "active" });
  await preparation.model.confirmModel(async () => {
    calls++;
    return {};
  });
  assert.equal(calls, 1);
  assert.equal(preparation.model.getSnapshot().intent, captured);
  end();
  assert.equal(signal.aborted, true);
  assert.equal(preparation.model.getSnapshot().stage, "SESSION_ENDED");
  assert.equal(preparation.model.getSnapshot().intent, undefined);
  assert.equal(runtime.sessionData.size, 0);
  const b = createWalletRuntime({
    scope: { ownerId: walletOwners.b, generation: 2 },
    queries,
    current: () => true,
  });
  const next = attachPaymentPreparation(b);
  assert.equal(next.model.getSnapshot().stage, "DRAFT");
  gate.resolve({ kind: "created", paymentId: "late-A" });
  await pending;
  assert.equal(next.model.getSnapshot().paymentId, undefined);
  assert.equal(calls, 1);
  assert.equal(next.runtime.capabilities.createPayment, false);
  b.dispose();
});

test("strict-effect activation starts a clean lifetime; uncooperative old create cannot enter it", async () => {
  const { runtime } = setup(),
    preparation = attachPaymentPreparation(runtime),
    gate = deferred<unknown>();
  preparation.model.edit("2000");
  preparation.model.review();
  const pending = preparation.model.confirmModel(() => gate.promise);
  runtime.dispose();
  runtime.activate();
  preparation.activate();
  gate.resolve({ kind: "created", paymentId: "retired" });
  await pending;
  assert.equal(preparation.model.getSnapshot().stage, "DRAFT");
  preparation.model.edit("2000");
  runtime.dispose();
  assert.equal(preparation.model.getSnapshot().draft.amountText, "");
});
test("keys bind owner and generation; cleanup only removes retired wallet scope", async () => {
  const { queries, runtime, end } = setup();
  const other = { ownerId: walletOwners.b, generation: 2 };
  queries.setQueryData(walletQueryKey(scope, "wallet"), walletModels.a);
  queries.setQueryData(walletQueryKey(other, "wallet"), walletModels.b);
  queries.setQueryData(["learning-requests", walletOwners.a], "preserved");
  runtime.sessionData.set("draft", "2000");
  runtime.sessionData.set("intent", { id: "model-only" });
  runtime.sessionData.set("qr", "synthetic");
  let detached = 0;
  runtime.addCleanup(() => detached++);
  end();
  assert.equal(runtime.sessionData.size, 0);
  assert.equal(detached, 1);
  assert.equal(
    queries.getQueryData(walletQueryKey(scope, "wallet")),
    undefined,
  );
  assert.deepEqual(
    queries.getQueryData(walletQueryKey(other, "wallet")),
    walletModels.b,
  );
  assert.equal(
    queries.getQueryData(["learning-requests", walletOwners.a]),
    "preserved",
  );
  assert.deepEqual(walletScopeKey(scope), ["wallet", walletOwners.a, 1]);
});
test("A response/error after session end cannot publish or replace B data, even if abort ignored", async () => {
  const { runtime, end } = setup();
  const gate = deferred<string>();
  let signal!: AbortSignal;
  const read = runtime.read("wallet", "balance", (s) => {
    signal = s;
    return gate.promise;
  });
  const rejected = assert.rejects(
    read,
    (error: unknown) => error instanceof AppError && error.kind === "session",
  );
  end();
  assert.equal(signal.aborted, true);
  gate.resolve("private A");
  await rejected;
  await assert.rejects(
    runtime.read("wallet", "balance", async () => "B"),
    AppError,
  );
});
test("superseded request ticket and external cancellation reject late results", async () => {
  const { runtime } = setup();
  const first = deferred<string>();
  const stale = assert.rejects(
    runtime.read("wallet", "balance", () => first.promise),
    AppError,
  );
  assert.equal(
    await runtime.read("wallet", "balance", async () => "latest"),
    "latest",
  );
  first.resolve("older");
  await stale;
  const controller = new AbortController(),
    gate = deferred<string>();
  const cancelled = assert.rejects(
    runtime.read(
      "wallet",
      "balance",
      async () => gate.promise,
      controller.signal,
    ),
    AppError,
  );
  controller.abort();
  gate.resolve("cancelled");
  await cancelled;
  runtime.dispose();
});
test("strict-effect reactivation never accepts work started in the retired lifetime", async () => {
  const { runtime } = setup();
  const gate = deferred<string>();
  const stale = assert.rejects(
    runtime.read("wallet", "balance", () => gate.promise),
    AppError,
  );
  runtime.dispose();
  runtime.activate();
  gate.resolve("old lifetime");
  await stale;
  assert.equal(
    await runtime.read("wallet", "balance", async () => "new lifetime"),
    "new lifetime",
  );
  runtime.dispose();
});
test("disabled P1 capabilities never invoke a read or mutation, including refocus/reconnect", async () => {
  const { queries } = setup();
  let calls = 0;
  const runtime = createWalletRuntime({ scope, queries, current: () => true });
  await assert.rejects(
    runtime.read("wallet", "balance", async () => ++calls),
    AppError,
  );
  await queries.refetchQueries({ type: "active" });
  assert.equal(calls, 0);
  assert.deepEqual(runtime.capabilities, noWalletCapabilities);
  runtime.dispose();
});
test("financial read states distinguish unavailable/loading/zero/stale/error/empty", () => {
  const unavailable = createReadAccess({ available: false });
  assert.equal(unavailable.getSnapshot().status, "unavailable");
  assert.equal(unavailable.begin(), null);
  const access = createReadAccess<
    typeof walletModels.a | typeof walletModels.zero
  >({ available: true });
  const first = access.begin()!;
  assert.equal(access.getSnapshot().status, "loading");
  access.accept(first, walletModels.zero);
  assert.equal(access.getSnapshot().status, "ready");
  const refresh = access.begin()!;
  assert.equal(access.getSnapshot().status, "refreshing");
  access.reject(refresh, new AppError("network"));
  assert.equal(access.getSnapshot().status, "refresh-error");
  assert.deepEqual(access.getSnapshot().data, walletModels.zero);
  const list = createReadAccess<string[]>({
    available: true,
    empty: (data) => !data.length,
  });
  list.accept(list.begin()!, []);
  assert.equal(list.getSnapshot().status, "empty");
});
test("403/404 revoke cached detail and no later transport error or older success revives it", () => {
  const forbidden = createReadAccess<string>({ available: true });
  forbidden.accept(forbidden.begin()!, "private");
  forbidden.reject(forbidden.begin()!, new AppError("http", 403));
  forbidden.reject(forbidden.begin()!, new AppError("network"));
  assert.equal(forbidden.getSnapshot().status, "denied");
  assert.equal(forbidden.getSnapshot().data, undefined);
  let evicted = 0;
  const access = createReadAccess<string>({
    available: true,
    onDenied: () => evicted++,
  });
  const older = access.begin()!;
  access.accept(older, "private");
  access.reject(
    access.begin()!,
    new AppError("http", 404, "CREDIT_TRANSACTION_NOT_FOUND"),
  );
  assert.equal(evicted, 1);
  assert.equal(access.getSnapshot().status, "not-found");
  access.accept(older, "cached private");
  access.reject(access.begin()!, new AppError("network"));
  assert.equal(access.getSnapshot().data, undefined);
  assert.equal(access.getSnapshot().status, "not-found");
  access.endSession();
  access.accept(access.begin() ?? 0, "late");
  assert.equal(access.getSnapshot().status, "session-ended");
});
test("runtime forwards the exact signal through existing authenticated HTTP; no adapter is installed", async () => {
  const fixture = await startWalletFixture();
  const { runtime } = setup();
  try {
    const http = createHttpClient(() => fixture.url);
    http.bindSession({
      generation: 1,
      getToken: async () => "fixture-a",
      renew: async () => {},
      expire: async () => {},
    });
    const result = await runtime.read("wallet", "balance", (signal) =>
      http.request("/me/wallet", { authenticated: true, signal }),
    );
    assert.deepEqual(result, walletModels.a);
    const gate = fixture.deferNext("/api/v1/me/wallet");
    const cancelled = assert.rejects(
      runtime.read("wallet", "balance", (signal) =>
        http.request("/me/wallet", { authenticated: true, signal }),
      ),
      AppError,
    );
    await gate.started;
    runtime.dispose();
    gate.release();
    await cancelled;
  } finally {
    runtime.dispose();
    await fixture.close();
  }
});

test("disabled/never-started observation cannot accept fabricated zero or cached data", () => {
  const disabled = createReadAccess<string>({ available: false });
  disabled.accept(0, "0.00");
  assert.deepEqual(disabled.getSnapshot(), {
    status: "unavailable",
    stale: false,
  });
  const waiting = createReadAccess<string>({ available: true });
  waiting.accept(0, "cached");
  assert.equal(waiting.getSnapshot().data, undefined);
});
test("retirement detaches parent signals without waiting for an uncooperative reader", async () => {
  const { runtime } = setup();
  const gate = deferred<string>();
  const parent = new AbortController();
  const remove = parent.signal.removeEventListener.bind(parent.signal);
  let detached = 0;
  parent.signal.removeEventListener = (...args: Parameters<typeof remove>) => {
    detached++;
    return remove(...args);
  };
  const stale = assert.rejects(
    runtime.read("wallet", "balance", () => gate.promise, parent.signal),
    AppError,
  );
  runtime.dispose();
  assert.equal(detached, 1);
  gate.resolve("old");
  await stale;
});
test("late A 401/network failures and cancelled queries cannot expire or repopulate B", async () => {
  for (const late of [new AppError("http", 401), new AppError("network")]) {
    const { runtime, queries, end } = setup();
    let reject!: (error: Error) => void;
    const gate = new Promise<string>((_, fail) => {
      reject = fail;
    });
    const oldRead = assert.rejects(
      runtime.read("wallet", "old", () => gate),
      (error: unknown) => error instanceof AppError && error.kind === "session",
    );
    end();
    reject(late);
    await oldRead;
    assert.equal(
      queries.getQueryData(walletQueryKey(scope, "wallet")),
      undefined,
    );
  }
  const { runtime, queries, end } = setup();
  const gate = deferred<string>();
  const key = walletQueryKey(scope, "pending");
  const oldQuery = assert.rejects(
    queries.fetchQuery({
      queryKey: key,
      queryFn: ({ signal }) =>
        runtime.read("wallet", "pending", () => gate.promise, signal),
    }),
  );
  end();
  gate.resolve("A");
  await oldQuery;
  assert.equal(queries.getQueryData(key), undefined);
});

test("source-contract fixture has 220 ordered entries, private snapshot cursors and owner detail denial", async () => {
  const fixture = await startWalletFixture();
  const get = (query: string, actor = "a") =>
    fetch(fixture.url + query, {
      headers: { Authorization: `Bearer fixture-${actor}` },
    });
  try {
    const first = await (await get("/me/wallet/transactions?limit=20")).json();
    assert.equal(first.data.length, 20);
    assert.equal(first.meta.pagination.limit, 20);
    assert.equal(first.data[0].id, "20000000-0000-4000-8000-000000000220");
    assert.equal("entrySequence" in first.data[0], false);
    fixture.append();
    const ids = new Set(first.data.map((row: { id: string }) => row.id));
    let cursor = first.meta.pagination.nextCursor;
    const originalCursor = cursor;
    while (cursor) {
      const page = await (
        await get(
          "/me/wallet/transactions?limit=20&cursor=" +
            encodeURIComponent(cursor),
        )
      ).json();
      for (const row of page.data) {
        assert.equal(ids.has(row.id), false);
        ids.add(row.id);
      }
      cursor = page.meta.pagination.nextCursor;
    }
    assert.equal(ids.size, 220);
    const refreshed = await (
      await get("/me/wallet/transactions?limit=20")
    ).json();
    assert.equal(refreshed.data[0].id, "20000000-0000-4000-8000-000000000221");
    assert.equal(
      (
        await get(
          "/me/wallet/transactions?limit=20&cursor=" + originalCursor,
          "b",
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await get(
          "/me/wallet/transactions?limit=20&type=HOLD&cursor=" + originalCursor,
        )
      ).status,
      400,
    );
    assert.equal(
      (await get("/me/wallet/transactions?limit=20&status=SUCCESS")).status,
      400,
    );
    assert.equal(
      (await get("/me/wallet/transactions/" + first.data[0].id, "b")).status,
      404,
    );
    for (const owner of ["zero", "absent"])
      assert.deepEqual(
        (await (await get("/me/wallet", owner)).json()).data,
        walletModels.zero,
      );
    const filtered = await (
      await get(
        "/me/wallet/transactions?limit=20&type=HOLD&referenceType=REVIEW",
      )
    ).json();
    assert(filtered.data.length > 0);
    assert(
      filtered.data.every(
        (row: { type: string; referenceType: string }) =>
          row.type === "HOLD" && row.referenceType === "REVIEW",
      ),
    );
    fixture.failNext(503);
    assert.equal((await get("/me/wallet")).status, 503);
    fixture.deny("b");
    assert.equal((await get("/me/wallet", "b")).status, 403);
  } finally {
    await fixture.close();
  }
});
