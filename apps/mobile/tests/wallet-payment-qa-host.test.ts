import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { selectPaymentQa } from "../src/qa/payment-qa-binding";

test("financial QA requires explicit native binding/actions; cannot be selected by route claims", () => {
  const current = {
    platform: "ios",
    environment: "https://qa.invalid/api/v1",
    ownerId: "a",
    buildId: "2",
  };
  const binding = {
    ...current,
    mode: "financial",
    distribution: "internal",
    actions: ["read", "create", "replay"],
  };
  assert.equal(selectPaymentQa(binding, current)?.mode, "financial");
  for (const change of [
    { actions: ["read", "create"] },
    { ownerId: "b" },
    { environment: "https://wrong.invalid" },
    { distribution: "production" },
  ])
    assert.equal(selectPaymentQa({ ...binding, ...change }, current), null);
});
test("financial host is mounted by private entry, never the ordinary topup route or preview", () => {
  const entry = readFileSync(
    new URL("../src/qa/payment-qa-entry.tsx", import.meta.url),
    "utf8",
  );
  assert.match(entry, /PaymentFinancialQaHost/);
  const host = readFileSync(
    new URL("../src/features/wallet/qa/payment-qa-host.tsx", import.meta.url),
    "utf8",
  );
  assert.match(host, /AppState/);
  assert.match(host, /\.pause\(/);
  assert.match(host, /\.bootstrap\(/);
  const normal = readFileSync(
    new URL("../src/features/wallet/views/topup-screen.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    normal,
    /PaymentFinancialQaHost|createPaymentCoordinator|openPaymentStore/,
  );
});
