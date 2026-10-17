import assert from "node:assert/strict";
import test from "node:test";
import {
  observePaymentModel,
  paymentOutcome,
  reconcilePaymentModel,
} from "../src/features/wallet/utils/payment-outcome";
import {
  paymentReceipt,
  paymentTarget,
} from "./fixtures/payment-observation-model";

test("six owner model states stay distinct from ledger; unknown codes are neutral", () => {
  const labels = new Set<string>();
  for (const state of [
    "CREATED",
    "PENDING",
    "PAID",
    "FAILED",
    "EXPIRED",
    "REFUNDED",
  ]) {
    const model = observePaymentModel(paymentReceipt(state), paymentTarget);
    assert.equal(model.state, state);
    assert.equal(model.amountVnd, "123000");
    assert.equal(model.credit, "123.00");
    assert(Object.isFrozen(model));
    labels.add(paymentOutcome(model.state));
  }
  assert.equal(labels.size, 6);
  for (const state of ["REVERSED", "SUCCESS", "UNFAMILIAR", "paid"]) {
    const model = observePaymentModel(paymentReceipt(state), paymentTarget);
    assert.equal(model.state, "UNKNOWN");
    assert.equal(paymentOutcome(model.state), "Chưa thể xác nhận trạng thái");
  }
});

test("forged provider/URL/QR/clock claims never supply owner observation fields", () => {
  const claims = {
    state: "PAID",
    amount: "123000",
    providerStatus: "PAID",
    qrClosed: true,
    expiresAt: "2000-01-01T00:00:00.000Z",
  };
  assert.throws(() => observePaymentModel(claims, paymentTarget));
  const model = observePaymentModel(
    { ...paymentReceipt("PENDING"), ...claims },
    paymentTarget,
  );
  assert.equal(model.state, "PENDING");
  assert.equal("expiresAt" in model, false);
  assert.equal("providerStatus" in model, false);
});

test("identity, owner/generation and exact reviewed money must match; invalid models cannot silently change quote", () => {
  const correct = paymentReceipt("PAID");
  for (const data of [
    { ...correct, scope: { ...correct.scope, ownerId: "other" } },
    { ...correct, scope: { ...correct.scope, generation: 2 } },
    { ...correct, payment: { ...correct.payment, paymentId: "wrong" } },
    { ...correct, payment: { ...correct.payment, amountVnd: "124000" } },
    { ...correct, payment: { ...correct.payment, amountVnd: 123000 } },
    { ...correct, payment: { ...correct.payment, credit: "123.001" } },
    { ...correct, payment: { ...correct.payment, credit: "124.00" } },
    { ...correct, payment: { ...correct.payment, state: null } },
  ])
    assert.throws(() => observePaymentModel(data, paymentTarget));
});

test("conflicts preserve previous snapshot stale; no status ranking or implicit refund/expiry transition", () => {
  const old = observePaymentModel(paymentReceipt("PAID"), paymentTarget);
  const same = reconcilePaymentModel(
    old,
    observePaymentModel(paymentReceipt("PAID"), paymentTarget),
  );
  assert.equal(same.data, old);
  assert.equal(same.conflict, false);
  for (const state of ["PENDING", "REFUNDED", "EXPIRED", "UNFAMILIAR"]) {
    const result = reconcilePaymentModel(
      old,
      observePaymentModel(paymentReceipt(state), paymentTarget),
    );
    assert.equal(result.data, old);
    assert.equal(result.conflict, true);
  }
  const pending = observePaymentModel(paymentReceipt("PENDING"), paymentTarget);
  assert.equal(reconcilePaymentModel(pending, old).data.state, "PENDING");
});
