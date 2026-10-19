import assert from "node:assert/strict";
import test from "node:test";
import { parseCreationPolicy } from "../src/features/wallet/schemas/payment-contracts";
import { createPaymentApi } from "../src/features/wallet/api/payment-api";
import { paymentId } from "./fixtures/payment-api";

test("creation policy validates required nullable fields and advisory consistency", () => {
  const allowed = {
    canCreate: true,
    reasonCode: null,
    existingPaymentId: null,
  };
  assert.deepEqual(parseCreationPolicy(allowed), allowed);
  const blocked = {
    canCreate: false,
    reasonCode: "PAYMENT_UNRESOLVED",
    existingPaymentId: paymentId,
  };
  assert.deepEqual(parseCreationPolicy(blocked), blocked);
  for (const field of Object.keys(allowed)) {
    const missing: Record<string, unknown> = { ...allowed };
    delete missing[field];
    assert.throws(() => parseCreationPolicy(missing));
  }
  for (const change of [
    { canCreate: 1 },
    { reasonCode: "" },
    { existingPaymentId: "x" },
    { reasonCode: "PAYMENT_CREATION_PAUSED" },
  ])
    assert.throws(() => parseCreationPolicy({ ...allowed, ...change }));
  assert.throws(() =>
    parseCreationPolicy({ ...blocked, reasonCode: "PAYMENT_CREATION_PAUSED" }),
  );
  assert.equal(
    parseCreationPolicy({
      canCreate: false,
      reasonCode: "NEW_REASON",
      existingPaymentId: null,
    }).canCreate,
    false,
  );
});
test("policy GET forwards auth/signal, no mutation or guessed error.details", async () => {
  const signal = new AbortController().signal;
  const api = createPaymentApi({
    request: async (path, options) => {
      assert.equal(path, "/payments/creation-policy");
      assert.equal(options?.method, "GET");
      assert.equal(options?.authenticated, true);
      assert.equal(options?.signal, signal);
      return {
        canCreate: false,
        reasonCode: "PAYMENT_RECONCILIATION_REQUIRED",
        existingPaymentId: paymentId,
      };
    },
  });
  assert.equal((await api.creationPolicy(signal)).existingPaymentId, paymentId);
});
