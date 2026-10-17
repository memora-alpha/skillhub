import assert from "node:assert/strict";
import test from "node:test";
import { createPaymentRefresh } from "../src/features/wallet/utils/payment-refresh";
import { observePaymentModel } from "../src/features/wallet/utils/payment-outcome";
import {
  deferred,
  paymentReceipt,
  paymentTarget,
} from "./fixtures/payment-observation-model";

const paid = observePaymentModel(paymentReceipt("PAID"), paymentTarget);
test("default unavailable/non-PAID coordinator cannot invoke related reads", async () => {
  const none = createPaymentRefresh({ payment: paid, current: () => true });
  await none.refresh();
  assert.equal(none.getSnapshot().wallet.status, "unavailable");
  let calls = 0;
  const pending = createPaymentRefresh({
    payment: { ...paid, state: "PENDING" },
    current: () => true,
    reads: { wallet: async () => ++calls, history: async () => ++calls },
  });
  await pending.refresh();
  assert.equal(calls, 0);
  assert.equal(pending.getSnapshot().payment?.state, "PENDING");
});

test("wallet/history settle independently in both failure directions and retain PAID; retry reads only", async () => {
  for (const failed of ["wallet", "history"] as const) {
    const calls = { wallet: 0, history: 0 };
    let fail = true;
    const read = (name: "wallet" | "history") => async () => {
      calls[name]++;
      if (fail && name === failed) throw new Error("synthetic read failure");
      return { ignored: true };
    };
    const refresh = createPaymentRefresh({
      payment: paid,
      current: () => true,
      reads: { wallet: read("wallet"), history: read("history") },
    });
    await refresh.refresh();
    assert.equal(refresh.getSnapshot().payment, paid);
    assert.equal(refresh.getSnapshot()[failed].status, "error");
    assert.equal(
      refresh.getSnapshot()[failed === "wallet" ? "history" : "wallet"].status,
      "success",
    );
    fail = false;
    await refresh.refresh(failed);
    assert.equal(calls[failed], 2);
    assert.equal(calls[failed === "wallet" ? "history" : "wallet"], 1);
    assert.equal(refresh.getSnapshot().payment?.state, "PAID");
    assert.equal("data" in refresh.getSnapshot().wallet, false);
    refresh.dispose();
  }
});

test("one settled refresh is visible while other is pending; repeated clicks coalesce per resource", async () => {
  const gate = deferred<unknown>();
  const calls = { wallet: 0, history: 0 };
  const refresh = createPaymentRefresh({
    payment: paid,
    current: () => true,
    reads: {
      wallet: async () => {
        calls.wallet++;
        throw new Error();
      },
      history: () => {
        calls.history++;
        return gate.promise;
      },
    },
  });
  const first = refresh.refresh(),
    second = refresh.refresh();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(refresh.getSnapshot().wallet.status, "error");
  assert.equal(refresh.getSnapshot().history.status, "loading");
  assert.deepEqual(calls, { wallet: 1, history: 1 });
  gate.resolve(undefined);
  await Promise.all([first, second]);
  assert.equal(refresh.getSnapshot().history.status, "success");
  refresh.dispose();
});

test("failed retry is stale only after prior successful read; both failures cannot roll back PAID", async () => {
  let fail = false;
  const read = async () => {
    if (fail) throw new Error();
  };
  const refresh = createPaymentRefresh({
    payment: paid,
    current: () => true,
    reads: { wallet: read, history: read },
  });
  await refresh.refresh();
  fail = true;
  await refresh.refresh();
  assert.equal(refresh.getSnapshot().wallet.stale, true);
  assert.equal(refresh.getSnapshot().history.stale, true);
  assert.equal(refresh.getSnapshot().payment?.state, "PAID");
  refresh.dispose();
});

test("retirement cancels and clears payment; ignored abort cannot republish A refresh metadata", async () => {
  const gate = deferred<unknown>();
  let signal!: AbortSignal;
  let current = true;
  const refresh = createPaymentRefresh({
    payment: paid,
    current: () => current,
    reads: {
      wallet: (s) => {
        signal = s;
        return gate.promise;
      },
      history: async () => {},
    },
  });
  const pending = refresh.refresh();
  current = false;
  refresh.dispose();
  await pending;
  assert.equal(signal.aborted, true);
  gate.resolve("late A");
  await Promise.resolve();
  assert.equal(refresh.getSnapshot().payment, undefined);
  assert.equal(refresh.getSnapshot().wallet.status, "unavailable");
});
