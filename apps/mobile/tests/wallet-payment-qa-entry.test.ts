import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { selectPaymentQa } from "../src/qa/payment-qa-binding";

const binding = {
  mode: "read",
  environment: "https://qa.invalid/api/v1",
  buildId: "internal-1",
  ownerId: "owner-a",
  actions: ["read"],
  distribution: "internal",
};
const current = {
  platform: "android",
  environment: binding.environment,
  ownerId: "owner-a",
  buildId: "internal-1",
};
test("private QA selection requires native matching build/environment/owner and explicit actions", () => {
  assert.equal(selectPaymentQa(binding, current)?.mode, "read");
  for (const change of [
    { platform: "web" },
    { ownerId: "owner-b" },
    { environment: "https://other.invalid/api/v1" },
    { buildId: "other" },
  ])
    assert.equal(selectPaymentQa(binding, { ...current, ...change }), null);
  for (const change of [
    { mode: "production" },
    { distribution: "production" },
    { actions: [] },
    { mode: "financial", actions: ["read"] },
  ])
    assert.equal(selectPaymentQa({ ...binding, ...change }, current), null);
  assert.equal(selectPaymentQa(undefined, current), null);
});
test("root actually mounts private entry; ordinary navigation stays the fallback", () => {
  const root = readFileSync(
    new URL("../src/app/_layout.tsx", import.meta.url),
    "utf8",
  );
  assert.match(root, /<PaymentQaEntry/);
  assert.match(root, /<AuthNavigator/);
  const entry = readFileSync(
    new URL("../src/qa/payment-qa-entry.tsx", import.meta.url),
    "utf8",
  );
  assert.match(entry, /selectPaymentQa/);
  assert.match(entry, /PaymentReadQaHost/);
  assert.doesNotMatch(entry, /useLocalSearchParams|fetch\(|axios/);
});
