import assert from "node:assert/strict";
import test from "node:test";
import { createQrPresentation } from "./fixtures/wallet-model-qr";

// QR-01 renderer/independent decoder cases are BLOCKED, specified in qr-validation.md.
// These executable tests assert only presentation state; there are no skipped/fake decode assertions.
export const syntheticPayloads = [
  "synthetic-only-0001",
  "  synthetic raw\nĐồng € 😀\r\n ",
  "synthetic-dense-" + "x".repeat(4096),
];
test("QR shell retains exact synthetic raw data and known model ID across render error/retry/close", () => {
  for (const raw of syntheticPayloads) {
    const qr = createQrPresentation("synthetic-payment");
    assert.equal(qr.getSnapshot().stage, "preparing");
    qr.readyModel(raw);
    assert.equal(qr.getSnapshot().raw, raw);
    assert.equal(qr.getSnapshot().stage, "ready-model");
    qr.renderError();
    assert.equal(qr.getSnapshot().stage, "render-error");
    qr.retryPresentation();
    assert.equal(qr.getSnapshot().stage, "ready-model");
    qr.close();
    assert.equal(qr.getSnapshot().paymentId, "synthetic-payment");
    assert.equal(qr.getSnapshot().raw, undefined);
    qr.readyModel(raw);
    assert.equal(qr.getSnapshot().paymentId, "synthetic-payment");
    assert.equal("paymentState" in qr.getSnapshot(), false);
    qr.dispose();
    assert.equal(qr.getSnapshot().paymentId, undefined);
    assert.equal(qr.getSnapshot().raw, undefined);
    qr.readyModel(raw);
    assert.equal(qr.getSnapshot().raw, undefined);
  }
});

test("empty payload is unavailable; render errors never create identities or encode/publish anything", () => {
  const qr = createQrPresentation("synthetic-payment");
  qr.readyModel("");
  assert.equal(qr.getSnapshot().stage, "unavailable");
  qr.renderError();
  qr.retryPresentation();
  assert.equal(qr.getSnapshot().stage, "unavailable");
  assert.equal(qr.getSnapshot().paymentId, "synthetic-payment");
});
