import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import { readPayload, readPagePayload } from "../src/lib/http/response";
import {
  parsePayment,
  validPaymentId,
} from "../src/features/wallet/schemas/payment-contracts";
import {
  paymentWire,
  paymentId,
  otherPaymentId,
  paymentStates,
  paymentSuccess,
  paymentPage,
  paymentFailure,
  startPaymentContractFixture,
} from "./fixtures/payment-api";

const protocol = (error: unknown) =>
  error instanceof AppError && error.kind === "protocol";
test("flat Payment DTO: seven states and unfamiliar values, no invented wire fields", () => {
  for (const state of [...paymentStates, "FUTURE_STATE"]) {
    const data = parsePayment(paymentWire(state), paymentId);
    assert.equal(data.status, state);
    assert.equal(data.id, paymentId);
    for (const key of [
      "owner",
      "scope",
      "payment",
      "quoteId",
      "policyVersion",
      "asOf",
      "reviewReason",
    ])
      assert.equal(key in data, false);
    assert(Object.isFrozen(data));
  }
  assert.equal(
    parsePayment({ ...paymentWire("PAID"), gateway: "LEGACY" }).gateway,
    "LEGACY",
  );
});
test("UUID and exact requested identity are required", () => {
  assert(validPaymentId(paymentId));
  for (const id of [null, "fixture", "", 1]) {
    assert.equal(validPaymentId(id), false);
    assert.throws(() => parsePayment({ ...paymentWire(), id }), protocol);
  }
  assert.throws(() => parsePayment(paymentWire(), otherPaymentId), protocol);
  assert.throws(() => parsePayment(paymentWire(), "bad-target"), protocol);
});
test("every flat field is required; nested preparation receipts cannot pass", () => {
  const raw = paymentWire();
  for (const key of Object.keys(raw)) {
    const malformed: Record<string, unknown> = { ...raw };
    delete malformed[key];
    assert.throws(() => parsePayment(malformed), protocol, key);
  }
  for (const value of [
    null,
    [],
    {},
    { scope: {}, payment: raw },
    paymentSuccess(raw),
  ])
    assert.throws(() => parsePayment(value), protocol);
});
test("exact money is never coerced, rounded or constrained by new-create input limits", () => {
  for (const paymentAmountVnd of [
    123000,
    "0",
    "0123000",
    "123000.00",
    "1e3",
    " 123000",
    "123000\n",
    "-1000",
  ])
    assert.throws(
      () => parsePayment({ ...paymentWire(), paymentAmountVnd }),
      protocol,
    );
  for (const creditAmount of [
    123,
    "123",
    "123.0",
    "123.001",
    "0123.00",
    "-123.00",
    "0.00",
    "123.00\n",
  ])
    assert.throws(
      () => parsePayment({ ...paymentWire(), creditAmount }),
      protocol,
    );
  const large = {
    ...paymentWire(),
    paymentAmountVnd: "9007199254740993000",
    creditAmount: "9007199254740993.00",
  };
  assert.equal(parsePayment(large).paymentAmountVnd, large.paymentAmountVnd);
  assert.equal(parsePayment(large).creditAmount, large.creditAmount);
  assert.throws(
    () => parsePayment({ ...paymentWire(), creditAmount: "124.00" }),
    protocol,
  );
});
test("numeric safe version/rate and supported monetary interpretation", () => {
  for (const value of [
    0,
    -1,
    1.1,
    "1",
    null,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(
      () => parsePayment({ ...paymentWire(), version: value }),
      protocol,
    );
    assert.throws(
      () =>
        parsePayment({ ...paymentWire(), conversionRateVndPerCredit: value }),
      protocol,
    );
  }
  assert.throws(
    () => parsePayment({ ...paymentWire(), conversionRateVndPerCredit: 2000 }),
    protocol,
  );
  assert.throws(
    () => parsePayment({ ...paymentWire(), currency: "USD" }),
    protocol,
  );
  for (const key of ["status", "gateway"])
    for (const value of ["", null, 3])
      assert.throws(
        () => parsePayment({ ...paymentWire(), [key]: value }),
        protocol,
      );
});
test("required nullable ISO dates, with no client expiry decision", () => {
  assert.equal(
    parsePayment({ ...paymentWire(), expiresAt: null, paidAt: null }).expiresAt,
    null,
  );
  assert.equal(
    parsePayment({
      ...paymentWire("PAID"),
      paidAt: "2026-10-17T00:30:00+07:00",
    }).paidAt,
    "2026-10-17T00:30:00+07:00",
  );
  assert(
    parsePayment({ ...paymentWire(), expiresAt: "2000-01-01T00:00:00Z" })
      .checkout,
  );
  for (const key of ["createdAt", "expiresAt", "paidAt"])
    for (const value of ["tomorrow", "2026-02-30T00:00:00Z", 0, "2026-10-17"])
      assert.throws(
        () => parsePayment({ ...paymentWire(), [key]: value }),
        protocol,
      );
  assert.throws(
    () => parsePayment({ ...paymentWire(), createdAt: null }),
    protocol,
  );
});
test("checkout null is valid; descriptor is PENDING-only and QR text is preserved exactly", () => {
  for (const status of [...paymentStates, "FUTURE_STATE"])
    assert.equal(
      parsePayment({ ...paymentWire(status), checkout: null }).checkout,
      null,
    );
  const qr = paymentWire().checkout!;
  const parsed = parsePayment(paymentWire());
  assert.deepEqual(parsed.checkout, qr);
  assert(Object.isFrozen(parsed.checkout));
  for (const status of paymentStates.filter((s) => s !== "PENDING"))
    assert.throws(
      () => parsePayment({ ...paymentWire(status), checkout: qr }),
      protocol,
    );
  for (const field of Object.keys(qr)) {
    const incomplete: Record<string, unknown> = { ...qr };
    delete incomplete[field];
    assert.throws(
      () => parsePayment({ ...paymentWire(), checkout: incomplete }),
      protocol,
    );
  }
  for (const change of [
    { providerStatus: "PAID" },
    { paymentLinkId: null },
    { orderCode: 123 },
    { orderCode: "1e3" },
    { orderCode: "123\n" },
    { qrCode: "" },
    { qrCode: null },
  ])
    assert.throws(
      () => parsePayment({ ...paymentWire(), checkout: { ...qr, ...change } }),
      protocol,
    );
});
test("loopback success/list/error envelopes use shared parsers, not a Payment adapter", async () => {
  const fixture = await startPaymentContractFixture();
  const get = async () => {
    const response = await fetch(fixture.url, {
      headers: { Authorization: "Bearer fixture-only" },
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    for (const code of [200, 201]) {
      fixture.respond(code, paymentSuccess(paymentWire("REVIEW")));
      const response = await get();
      assert.equal(
        parsePayment(readPayload(response.status, response.body)).status,
        "REVIEW",
      );
    }
    fixture.respond(200, paymentPage());
    const pageResponse = await get(),
      page = readPagePayload(pageResponse.status, pageResponse.body);
    assert.equal(page.pagination.limit, 20);
    assert.equal(parsePayment(page.data[0]).id, paymentId);
    for (const [code, message, expected] of [
      [404, "PAYMENT_NOT_FOUND", "PAYMENT_NOT_FOUND"],
      [409, "Idempotency key conflict", ""],
      [503, "PAYMENT_PROVIDER_UNAVAILABLE", "PAYMENT_PROVIDER_UNAVAILABLE"],
    ] as const) {
      fixture.respond(code, paymentFailure(code, message));
      const response = await get();
      assert.throws(
        () => readPayload(response.status, response.body),
        (e) =>
          e instanceof AppError && e.status === code && e.code === expected,
      );
    }
    assert(fixture.events.every((e) => e.method === "GET" && e.authorized));
    assert.equal(fixture.events.length, 6);
  } finally {
    await fixture.close();
  }
});
test("malformed standard/list envelopes remain rejected by unchanged shared parser", () => {
  for (const payload of [
    paymentWire(),
    { success: false, data: paymentWire() },
    { success: true },
  ])
    assert.throws(() => readPayload(200, payload), protocol);
  for (const pagination of [
    { limit: 100, hasMore: false, nextCursor: null },
    { limit: 20, hasMore: true, nextCursor: null },
    { limit: 20, hasMore: false, nextCursor: "opaque" },
  ])
    assert.throws(
      () => readPagePayload(200, { ...paymentPage(), meta: { pagination } }),
      protocol,
    );
});

test("recovery fields are required, nullable reason is preserved and malformed values fail", () => {
  for (const change of [
    { recoveryRequired: false, recoveryReason: "WARNING" },
    { recoveryRequired: true, recoveryReason: null },
  ])
    assert.throws(
      () => parsePayment({ ...paymentWire("PAID"), ...change }),
      protocol,
    );
  for (const field of ["recoveryRequired", "recoveryReason"]) {
    const wire: Record<string, unknown> = { ...paymentWire() };
    delete wire[field];
    assert.throws(() => parsePayment(wire), protocol);
  }
  for (const change of [
    { recoveryRequired: null },
    { recoveryRequired: 1 },
    { recoveryReason: 7 },
    { recoveryReason: "" },
  ])
    assert.throws(
      () => parsePayment({ ...paymentWire(), ...change }),
      protocol,
    );
  const unknown = parsePayment({
    ...paymentWire("PAID"),
    recoveryRequired: true,
    recoveryReason: "FUTURE_REASON",
  });
  assert.equal(unknown.recoveryRequired, true);
  assert.equal(unknown.recoveryReason, "FUTURE_REASON");
});
