import assert from "node:assert/strict";
import test from "node:test";
import {
  paymentStatusPresentation,
  paymentStatusId,
} from "../src/features/wallet/utils/payment-status-presentation";
import { parsePayment } from "../src/features/wallet/schemas/payment-contracts";
import { paymentOutcome } from "../src/features/wallet/utils/payment-outcome";
import { paymentWire, paymentId, paymentStates } from "./fixtures/payment-api";

test("status presentation maps seven owner outcomes/unknown without trusting URL claims", () => {
  for (const raw of [...paymentStates, "FUTURE_STATE"]) {
    const state = paymentStatusPresentation({
      status: "ready",
      data: parsePayment(paymentWire(raw)),
      stale: false,
    });
    assert.equal(state.data?.state, raw === "FUTURE_STATE" ? "UNKNOWN" : raw);
    assert.equal(state.data?.amountVnd, "123000");
    assert.equal(state.data?.credit, "123.00");
    assert.equal(state.data?.paymentId, paymentId);
    assert(paymentOutcome(state.data!.state));
  }
  assert.equal(
    paymentStatusId({
      id: paymentId,
      state: "PAID",
      amount: "999999",
      providerStatus: "PAID",
    }),
    paymentId,
  );
  for (const params of [
    { id: "sample" },
    { id: [paymentId] },
    { paymentId },
    { status: "PAID" },
    {},
  ])
    assert.equal(paymentStatusId(params), "");
});
test("read errors/denial/unavailable/stale stay separate from accepted PAID", () => {
  for (const status of [
    "unavailable",
    "loading",
    "error",
    "denied",
    "not-found",
    "session-ended",
  ] as const) {
    const state = paymentStatusPresentation({ status, stale: false });
    assert.equal(state.status, status);
    assert.equal(state.data, undefined);
  }
  const stale = paymentStatusPresentation({
    status: "refresh-error",
    stale: true,
    issue: "conflict",
    data: parsePayment(paymentWire("PAID")),
  });
  assert.equal(stale.data?.state, "PAID");
  assert.equal(stale.issue, "conflict");
  assert(stale.stale);
});
