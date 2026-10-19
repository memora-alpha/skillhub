import assert from "node:assert/strict";
import test from "node:test";
import { simplePaymentCopy } from "../src/features/wallet/utils/payment-simple-copy";
import { paymentStatusPresentation } from "../src/features/wallet/utils/payment-status-presentation";
import { parsePayment } from "../src/features/wallet/schemas/payment-contracts";
import { paymentWire } from "./fixtures/payment-api";

const view = (status: string) =>
  paymentStatusPresentation({
    status: "ready",
    stale: false,
    data: parsePayment(paymentWire(status)),
  });
test("simple checkout never presents CREATED, pending, review, unknown or QR as completion", () => {
  assert.equal(
    simplePaymentCopy(view("CREATED"), false).title,
    "Đang chuẩn bị mã QR",
  );
  assert.equal(
    simplePaymentCopy(view("PENDING"), true).title,
    "Quét mã để thanh toán",
  );
  for (const status of [
    "CREATED",
    "PENDING",
    "REVIEW",
    "FUTURE_STATE",
    "FAILED",
    "EXPIRED",
    "REFUNDED",
  ])
    assert.equal(simplePaymentCopy(view(status), true).success, false);
  assert.equal(simplePaymentCopy(view("PAID"), false).success, true);
});
test("denial/loading do not show a retained financial result; stale PAID stays success", () => {
  const paid = view("PAID");
  for (const status of [
    "denied",
    "not-found",
    "session-ended",
    "unavailable",
    "loading",
  ] as const)
    assert.equal(
      simplePaymentCopy({ ...paid, status }, false).showAmount,
      false,
    );
  assert.equal(
    simplePaymentCopy({ ...paid, status: "refresh-error", stale: true }, false)
      .success,
    true,
  );
  assert.equal(
    simplePaymentCopy({ ...paid, status: "refresh-error", stale: true }, false)
      .showAmount,
    true,
  );
});
