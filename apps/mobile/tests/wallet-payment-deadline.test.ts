import assert from "node:assert/strict";
import test from "node:test";
import { paymentDeadline } from "../src/features/wallet/utils/payment-deadline";

test("deadline is derived from server expiry and never declares a financial outcome or renews QR", () => {
  const now = Date.parse("2026-10-22T00:00:00Z");
  assert.deepEqual(paymentDeadline("2026-10-22T00:14:59Z", now), {
    kind: "countdown",
    label: "14:59",
  });
  assert.deepEqual(paymentDeadline("2026-10-22T01:00:00Z", now), {
    kind: "countdown",
    label: "60:00",
  });
  assert.deepEqual(paymentDeadline("2026-10-22T07:00:01+07:00", now + 1), {
    kind: "countdown",
    label: "00:01",
  });
  for (const expiry of ["2026-10-22T00:00:00Z", "2026-10-21T23:00:00Z"])
    assert.deepEqual(paymentDeadline(expiry, now), {
      kind: "awaiting-server",
      label: "Chờ xác nhận",
    });
  for (const expiry of [null, "invalid"])
    assert.deepEqual(paymentDeadline(expiry, now), {
      kind: "unavailable",
      label: "Đang cập nhật",
    });
});
