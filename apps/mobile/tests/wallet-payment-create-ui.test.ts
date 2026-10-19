import assert from "node:assert/strict";
import test from "node:test";
import { createPaymentUi } from "../src/features/wallet/utils/payment-create-ui";
import { parsePayment } from "../src/features/wallet/schemas/payment-contracts";
import { createPaymentObservation } from "../src/features/wallet/utils/payment-observation";
import { paymentWire, paymentId } from "./fixtures/payment-api";

test("review remains estimate until exact backend quote; Confirm limited to review/idle", () => {
  for (const stage of [
    "loading",
    "draft",
    "claiming",
    "unknown",
    "blocked",
    "known",
    "ended",
  ] as const)
    assert.equal(
      createPaymentUi({ stage, draft: "123000", busy: false }).canConfirm,
      false,
    );
  assert.equal(
    createPaymentUi({ stage: "review", draft: "123000", busy: false })
      .canConfirm,
    true,
  );
  assert.equal(
    createPaymentUi({ stage: "review", draft: "123000", busy: true })
      .canConfirm,
    false,
  );
  assert.match(
    createPaymentUi({ stage: "review", draft: "123000", busy: false })
      .quoteLabel,
    /ước tính/,
  );
});
test("missing/suppressed/REVIEW/stale QR never becomes a replacement or client result", () => {
  const target = { scope: { ownerId: "a", generation: 1 }, paymentId };
  for (const status of ["PAID", "REVIEW", "FUTURE_STATE"]) {
    const payment = parsePayment(paymentWire(status));
    const observation = { ...createPaymentObservation(target), data: payment };
    const view = createPaymentUi({
      stage: "known",
      draft: "123000",
      busy: false,
      payment,
      observation,
    });
    assert.equal(view.qr.stage, "unavailable");
    assert.equal(view.canConfirm, false);
    assert.match(view.quoteLabel, /xác nhận/);
  }
  const payment = parsePayment(paymentWire());
  const observation = {
    ...createPaymentObservation(target),
    data: payment,
    suppressedVersion: payment.version,
  };
  assert.equal(
    createPaymentUi({
      stage: "known",
      draft: "123000",
      busy: false,
      payment,
      observation,
    }).qr.stage,
    "unavailable",
  );
});

test("synthetic create preview supports effect cleanup/reactivation without account state", async () => {
  const { createInertTopupHost } =
    await import("../src/features/wallet/preview/create-host");
  const host = createInertTopupHost(),
    session = host.createModel();
  session.dispose();
  session.activate();
  session.model.activate();
  await session.model.bootstrap();
  assert.equal(session.model.getSnapshot().stage, "draft");
  assert.equal(host.counts().createCalls, 0);
});
