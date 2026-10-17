import assert from "node:assert/strict";
import test from "node:test";
import {
  creditAmount,
  creditDelta,
  formatCredit,
  vndAmount,
  formatVnd,
} from "../src/features/wallet/utils/amount";
import {
  exactCreditExamples,
  malformedCreditExamples,
} from "./fixtures/wallet-model";

test("Credit decimal text is already CR; preserve every digit without /100", () => {
  for (const value of exactCreditExamples)
    assert.equal(creditAmount(value), value);
  assert.equal(
    formatCredit("9007199254740993.01"),
    "9.007.199.254.740.993,01 CR",
  );
  assert.equal(formatCredit("0.01"), "0,01 CR");
  assert.equal(formatCredit("123.45"), "123,45 CR");
});
test("reject coercion, whitespace, exponent and excess precision rather than rounding", () => {
  for (const value of malformedCreditExamples)
    assert.throws(() => creditAmount(value));
  assert.throws(() => creditAmount("-1.00"));
  assert.throws(() => creditAmount("-0.00"));
});
test("delta is signed independently of magnitude; negative zero normalizes exactly", () => {
  assert.equal(creditDelta("-12.34"), "-12.34");
  assert.equal(creditDelta("-0.00"), "0.00");
  assert.equal(formatCredit("-12.34", { signed: true }), "-12,34 CR");
  assert.equal(formatCredit("12.34", { signed: true }), "+12,34 CR");
  assert.equal(formatCredit("-0.00", { signed: true }), "0,00 CR");
});
test("VND input is exact canonical positive integer text, without top-up policy here", () => {
  assert.equal(vndAmount("900719925474099301"), "900719925474099301");
  assert.equal(formatVnd("2000000"), "2.000.000 VND");
  for (const value of [
    "",
    "0",
    "-1",
    "+1",
    "01",
    "1.5",
    "1e3",
    " 1000",
    "1000\n",
    1000,
  ])
    assert.throws(() => vndAmount(value));
});
