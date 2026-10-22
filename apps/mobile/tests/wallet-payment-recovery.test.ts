import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { createWalletRuntime } from "../src/features/wallet/context/wallet-runtime";
import { createPaymentObserver } from "./fixtures/wallet-model-observer";
import {
  deferred,
  paymentReceipt,
  paymentTarget,
} from "./fixtures/payment-observation-model";

// GAP-06 acceptance data only. No journal, credentials, guessed lookup or create.
export const blockedRecoveryCases = [
  {
    case: "V25-known-ID",
    layer: "C/A/G/NA/NI",
    status: "BLOCKED",
    prerequisite:
      "Implemented owner identity/status/restart authorization contract",
  },
  {
    case: "V25-lost-ID",
    layer: "C/A/G/NA/NI",
    status: "BLOCKED",
    prerequisite:
      "Durable same-intent/lost-ID reconciliation, retention/replay/fingerprint and backend proof",
  },
] as const;
test("known model ID permits only explicitly injected owner read; no configured reader means no recovery", async () => {
  const known = createPaymentObserver({
    scope: paymentTarget.scope,
    target: paymentTarget,
    current: () => true,
  });
  await known.check();
  assert.equal(known.canCheck(), false);
  assert.equal(known.getSnapshot().status, "unavailable");
  assert(
    blockedRecoveryCases.every(
      (row) => row.status === "BLOCKED" && row.prerequisite.length,
    ),
  );
});

test("lost ID cannot be recovered by amount/body matching, and cannot invoke a reader or allocate identity", async () => {
  let reads = 0;
  const lost = createPaymentObserver({
    scope: paymentTarget.scope,
    target: {
      amountVnd: paymentTarget.amountVnd,
      credit: paymentTarget.credit,
    },
    current: () => true,
    read: async () => {
      reads++;
      return paymentReceipt("PAID");
    },
  });
  await lost.check();
  lost.pause();
  lost.resume();
  await lost.check();
  assert.equal(reads, 0);
  assert.equal(lost.getSnapshot().data, undefined);
  assert.equal(lost.getSnapshot().status, "unavailable");
});

test("process-memory loss and same-owner reauth leave new runtimes gated, not silently recovered", async () => {
  const queries = new QueryClient();
  const a = createWalletRuntime({
    scope: paymentTarget.scope,
    queries,
    current: () => true,
  });
  const observer = createPaymentObserver({
    scope: a.scope,
    target: paymentTarget,
    current: a.isCurrent,
    read: async () => paymentReceipt("PAID"),
  });
  a.addCleanup(observer.dispose);
  await observer.check();
  const sameScreen = observer;
  assert.equal(sameScreen.getSnapshot().data?.state, "PAID");
  a.dispose();
  const reauth = createWalletRuntime({
    scope: { ...paymentTarget.scope, generation: 2 },
    queries,
    current: () => true,
  });
  const fresh = createPaymentObserver({
    scope: reauth.scope,
    current: reauth.isCurrent,
  });
  reauth.addCleanup(fresh.dispose);
  await fresh.check();
  assert.equal(fresh.getSnapshot().data, undefined);
  assert.equal(reauth.sessionData.size, 0);
  assert.equal(reauth.capabilities.recovery, false);
  assert.equal(reauth.capabilities.createPayment, false);
  reauth.dispose();
});

test("A known ID and late result cannot authorize B after relogin; no private fallback is retained", async () => {
  const gate = deferred<unknown>();
  let reads = 0;
  const a = createPaymentObserver({
    scope: paymentTarget.scope,
    target: paymentTarget,
    current: () => true,
    read: () => gate.promise,
  });
  const pending = a.check();
  a.dispose();
  await pending;
  const b = createPaymentObserver({
    scope: { ownerId: "synthetic-owner-b", generation: 2 },
    target: paymentTarget,
    current: () => true,
    read: async () => {
      reads++;
      return paymentReceipt("PAID");
    },
  });
  await b.check();
  gate.resolve(paymentReceipt("PAID"));
  await Promise.resolve();
  assert.equal(reads, 0);
  assert.equal(b.getSnapshot().data, undefined);
  assert.equal(a.getSnapshot().data, undefined);
});
