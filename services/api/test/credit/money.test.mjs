import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseCredit,
  formatCredit,
  feeSplit,
  vndToCredit,
  parseVnd,
} from "../../dist/modules/credit/domain/money.js";

test("Credit parses and formats exact signed hundredths including sub-unit negatives", () => {
  assert.equal(parseCredit("9999999999.99"), 999999999999n);
  assert.equal(parseCredit("0.01"), 1n);
  assert.equal(parseCredit("10.1"), 1010n);
  assert.equal(formatCredit(-1n), "-0.01");
  assert.equal(formatCredit(-1001n), "-10.01");
  assert.equal(formatCredit(0n), "0.00");
  for (const value of [
    "1.001",
    "01",
    "1e2",
    "-1",
    "1.",
    "10000000000",
    1,
    null,
  ]) {
    assert.throws(() => parseCredit(value), /INVALID_CREDIT_AMOUNT/);
  }
});

test("fee floors only the 4% leg and conserves every small-unit split", () => {
  assert.deepEqual(feeSplit(1001n), { fee: 40n, net: 961n });
  assert.deepEqual(feeSplit(1n), { fee: 0n, net: 1n });
  for (let gross = 1n; gross <= 5000n; gross++) {
    const { fee, net } = feeSplit(gross);
    assert.equal(net + fee, gross);
    assert.ok(fee * 10000n <= gross * 400n);
    assert.ok((fee + 1n) * 10000n > gross * 400n);
  }
  assert.throws(() => feeSplit(-1n));
});

test("VND conversion rejects fractional Credit instead of rounding or floating", () => {
  assert.equal(vndToCredit(100000n), 10000n);
  assert.equal(vndToCredit(10n), 1n);
  assert.throws(() => vndToCredit(11n), /UNREPRESENTABLE_CREDIT_AMOUNT/);
  assert.equal(parseVnd("100000.00"), 100000n);
  for (const value of [
    "100.01",
    "1e3",
    "-1",
    "0",
    100000,
    "900000000000000000000000",
  ]) {
    assert.throws(() => parseVnd(value), /INVALID_VND_AMOUNT/);
  }
});
