import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { AppError } from "../src/lib/http/errors";
import { createPaymentObserver } from "../src/features/wallet/utils/payment-observer";
import {
  deferred,
  paymentReceipt,
  paymentTarget,
} from "./fixtures/payment-observation-model";
import { createWalletRuntime } from "../src/features/wallet/context/wallet-runtime";
import { createPaymentRefresh } from "../src/features/wallet/utils/payment-refresh";
import { observePaymentModel } from "../src/features/wallet/utils/payment-outcome";

const setup = (read?: (signal: AbortSignal) => Promise<unknown>) =>
  createPaymentObserver({
    scope: paymentTarget.scope,
    target: paymentTarget,
    current: () => true,
    read: read ? (_target, signal) => read(signal) : undefined,
  });
test("unconfigured/missing/invalid/cross-scope target stays unavailable and never dispatches", async () => {
  let calls = 0;
  const absent = setup();
  await absent.check();
  assert.equal(absent.getSnapshot().status, "unavailable");
  assert.equal(absent.canCheck(), false);
  for (const target of [
    undefined,
    { ...paymentTarget, paymentId: "" },
    { ...paymentTarget, credit: "123.001" },
    { ...paymentTarget, scope: { ...paymentTarget.scope, ownerId: "B" } },
  ]) {
    const observer = createPaymentObserver({
      scope: paymentTarget.scope,
      target,
      current: () => true,
      read: async () => {
        calls++;
        return paymentReceipt();
      },
    });
    await observer.check();
    assert.equal(observer.canCheck(), false);
  }
  assert.equal(calls, 0);
});

test("same-tick checks coalesce before notification and forward a signal; no automatic schedule", async () => {
  const gate = deferred<unknown>();
  let calls = 0,
    forwarded!: AbortSignal;
  const observer = setup((signal) => {
    calls++;
    forwarded = signal;
    return gate.promise;
  });
  let second: Promise<void> | undefined;
  observer.subscribe(() => {
    if (observer.getSnapshot().status === "loading") second = observer.check();
  });
  const first = observer.check();
  assert.equal(first, second);
  assert.equal(observer.check(), first);
  assert.equal(calls, 1);
  assert.equal(forwarded.aborted, false);
  gate.resolve(paymentReceipt());
  await first;
  assert.equal(observer.getSnapshot().data?.state, "PENDING");
  assert.equal(calls, 1);
  observer.dispose();
});

test("pause aborts/detaches old check; resume alone does not read and late old reply cannot replace newer result", async () => {
  const old = deferred<unknown>();
  let calls = 0,
    oldSignal!: AbortSignal;
  const observer = setup((signal) => {
    calls++;
    if (calls === 1) {
      oldSignal = signal;
      return old.promise;
    }
    return Promise.resolve(paymentReceipt("PAID"));
  });
  const first = observer.check();
  observer.pause();
  assert.equal(oldSignal.aborted, true);
  await first;
  assert.equal(observer.canCheck(), false);
  observer.resume();
  assert.equal(calls, 1);
  await observer.check();
  old.resolve(paymentReceipt("PENDING"));
  await Promise.resolve();
  assert.equal(observer.getSnapshot().data?.state, "PAID");
  assert.equal(calls, 2);
  observer.dispose();
});

test("later error preserves accepted data; conflicting state remains stale without inventing freshness", async () => {
  let mode = "PAID";
  const observer = setup(async () => {
    if (mode === "error") throw new AppError("network");
    return paymentReceipt(mode);
  });
  await observer.check();
  mode = "PENDING";
  await observer.check();
  assert.equal(observer.getSnapshot().data?.state, "PAID");
  assert.equal(observer.getSnapshot().issue, "conflict");
  assert.equal(observer.getSnapshot().stale, true);
  mode = "error";
  await observer.check();
  assert.equal(observer.getSnapshot().data?.state, "PAID");
  assert.equal(observer.getSnapshot().status, "refresh-error");
  mode = "PAID";
  await observer.check();
  assert.equal(observer.getSnapshot().stale, false);
  observer.dispose();
});

test("403/404 evicts private projection and later transient/protocol failure cannot resurrect it", async () => {
  for (const denial of [403, 404]) {
    let mode: string | number = "PAID";
    const observer = setup(async () => {
      if (typeof mode === "number") throw new AppError("http", mode);
      if (mode === "network") throw new AppError("network");
      if (mode === "malformed") return {};
      return paymentReceipt(mode);
    });
    await observer.check();
    mode = denial;
    await observer.check();
    const status = denial === 403 ? "denied" : "not-found";
    assert.equal(observer.getSnapshot().status, status);
    assert.equal(observer.getSnapshot().data, undefined);
    for (mode of ["network", "malformed"]) {
      await observer.check();
      assert.equal(observer.getSnapshot().status, status);
      assert.equal(observer.getSnapshot().data, undefined);
    }
    observer.dispose();
  }
});

test("wrong model owner/identity/quote causes read error, never a private or successful replacement", async () => {
  const observer = setup(async () => ({
    ...paymentReceipt("PAID"),
    scope: { ownerId: "B", generation: 1 },
  }));
  await observer.check();
  assert.equal(observer.getSnapshot().status, "error");
  assert.equal(observer.getSnapshot().data, undefined);
  observer.dispose();
});

test("retirement ignores uncooperative old success/failure; B controller stays independent", async () => {
  for (const failure of [false, true]) {
    const gate = deferred<unknown>();
    let current = true;
    const a = createPaymentObserver({
      scope: paymentTarget.scope,
      target: paymentTarget,
      current: () => current,
      read: () => gate.promise,
    });
    const pending = a.check();
    current = false;
    a.dispose();
    await pending;
    const b = setup(async () => paymentReceipt("PAID"));
    await b.check();
    if (failure) gate.reject(new AppError("http", 401));
    else gate.resolve(paymentReceipt("REFUNDED"));
    await Promise.resolve();
    assert.equal(a.getSnapshot().data, undefined);
    assert.equal(a.getSnapshot().status, "session-ended");
    assert.equal(b.getSnapshot().data?.state, "PAID");
    b.dispose();
  }
});

test("synchronous disposal during loading notification prevents reader dispatch", async () => {
  let calls = 0;
  const observer = setup(async () => {
    calls++;
    return paymentReceipt();
  });
  observer.subscribe(() => {
    if (observer.getSnapshot().status === "loading") observer.dispose();
  });
  await observer.check();
  assert.equal(calls, 0);
  assert.equal(observer.getSnapshot().data, undefined);
});

test("US3 session cleanup integrates core runtime without any US2 intent module or live capabilities", async () => {
  const runtime = createWalletRuntime({
    scope: paymentTarget.scope,
    queries: new QueryClient(),
    current: () => true,
  });
  const gate = deferred<unknown>(),
    refreshGate = deferred<unknown>();
  let observedSignal!: AbortSignal, refreshSignal!: AbortSignal;
  const observer = createPaymentObserver({
    scope: runtime.scope,
    target: paymentTarget,
    current: runtime.isCurrent,
    read: (_target, signal) => {
      observedSignal = signal;
      return gate.promise;
    },
  });
  const refresh = createPaymentRefresh({
    payment: observePaymentModel(paymentReceipt("PAID"), paymentTarget),
    current: runtime.isCurrent,
    reads: {
      wallet: (signal) => {
        refreshSignal = signal;
        return refreshGate.promise;
      },
      history: async () => {},
    },
  });
  runtime.addCleanup(observer.dispose);
  runtime.addCleanup(refresh.dispose);
  const pending = observer.check(),
    refreshing = refresh.refresh();
  runtime.dispose();
  await Promise.all([pending, refreshing]);
  assert.equal(observedSignal.aborted, true);
  assert.equal(refreshSignal.aborted, true);
  gate.resolve(paymentReceipt("PAID"));
  refreshGate.reject(new Error("old"));
  await Promise.resolve();
  assert.equal(observer.getSnapshot().data, undefined);
  assert.equal(refresh.getSnapshot().payment, undefined);
  assert.equal(runtime.capabilities.paymentStatus, false);
  assert.equal(runtime.capabilities.createPayment, false);
});
