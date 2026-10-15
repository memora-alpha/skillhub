import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { paymentConfiguration } from "../../dist/modules/payments/domain/payment-config.js";
import { PayosGateway } from "../../dist/modules/payments/infrastructure/payos-gateway.js";
import { createTopUpQuote } from "../../dist/modules/payments/domain/top-up-policy.js";

// Public payOS documentation vector, never merchant credentials:
// https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/
const checksum =
  "1a54716c8f0efb2744fb28b6e38b25da7f67a925d98bc1c18bd8faaecadd7675";
const env = {
  PAYMENTS_ENABLED: "true",
  PAYOS_CLIENT_ID: "fixture-channel",
  PAYOS_API_KEY: "fixture-api-key",
  PAYOS_CHECKSUM_KEY: checksum,
  PAYOS_RETURN_URL: "https://app.fixture.invalid/payment/success",
  PAYOS_CANCEL_URL: "https://app.fixture.invalid/payment/cancel",
};
const now = new Date("2026-10-15T01:00:00Z");
const quote = {
  orderCode: "123",
  paymentAmountVnd: 3000n,
  expiresAt: new Date("2026-10-15T02:00:00Z"),
};
const gateway = () => new PayosGateway(paymentConfiguration(env));

function payload() {
  return {
    code: "00",
    desc: "success",
    success: true,
    data: {
      orderCode: 123,
      amount: 3000,
      description: "VQRIO123",
      accountNumber: "12345678",
      reference: "TF230204212323",
      transactionDateTime: "2023-02-04 18:25:00",
      currency: "VND",
      paymentLinkId: "124c33293c43417ab7879e14c8d9eb18",
      code: "00",
      desc: "Thành công",
      counterAccountBankId: "",
      counterAccountBankName: "",
      counterAccountName: "",
      counterAccountNumber: "",
      virtualAccountName: "",
      virtualAccountNumber: "",
    },
    signature:
      "412e915d2871504ed31be63c8f62a149a4410d34c4c42affc9006ef9917eaa03",
  };
}
function sign(body) {
  const canonical = Object.keys(body.data)
    .sort((a, b) => (a < b ? -1 : Number(a > b)))
    .map((key) => {
      const value = body.data[key];
      return `${key}=${[null, "null", "undefined"].includes(value) ? "" : value}`;
    })
    .join("&");
  return {
    ...body,
    signature: createHmac("sha256", checksum).update(canonical).digest("hex"),
  };
}
function response() {
  return sign({
    code: "00",
    data: {
      orderCode: 123,
      amount: 3000,
      paymentLinkId: "provider-link",
      currency: "VND",
      status: "PENDING",
      checkoutUrl: "https://pay.payos.vn/web/provider-link",
      qrCode: "fixture-qr",
    },
  });
}

test("approved top-up bounds, step and 60 minute expiry stay unchanged", () => {
  assert.equal(createTopUpQuote(1000n, now).creditUnits, 100n);
  assert.equal(createTopUpQuote(2000000n, now).creditUnits, 200000n);
  assert.equal(
    createTopUpQuote(1000n, now).expiresAt.toISOString(),
    quote.expiresAt.toISOString(),
  );
  for (const invalid of [0n, 999n, 1001n, 2000001n])
    assert.throws(() => createTopUpQuote(invalid, now));
});

test("payOS is disabled by default and validates all channel credentials and HTTPS URLs", () => {
  assert.equal(paymentConfiguration({}).enabled, false);
  assert.throws(() => paymentConfiguration({ PAYMENTS_ENABLED: "typo" }));
  assert.throws(
    () =>
      paymentConfiguration({
        PAYMENTS_ENABLED: "true",
        SEPAY_MERCHANT_ID: "legacy",
      }),
    /PAYOS_CLIENT_ID/,
  );
  for (const name of [
    "PAYOS_CLIENT_ID",
    "PAYOS_API_KEY",
    "PAYOS_CHECKSUM_KEY",
    "PAYOS_RETURN_URL",
    "PAYOS_CANCEL_URL",
  ]) {
    assert.throws(
      () => paymentConfiguration({ ...env, [name]: "" }),
      new RegExp(name),
    );
  }
  for (const url of [
    "http://insecure.invalid",
    "https://user:secret@app.fixture.invalid",
    "https://app.fixture.invalid/#token",
  ])
    assert.throws(
      () => paymentConfiguration({ ...env, PAYOS_RETURN_URL: url }),
      /PAYOS_RETURN_URL/,
    );
  const disabled = new PayosGateway(paymentConfiguration({}));
  assert.throws(
    () => disabled.prepareCheckout(quote, now),
    /PAYMENT_PROVIDER_UNAVAILABLE/,
  );
  assert.throws(
    () => disabled.verifyWebhook(payload()),
    /PAYMENT_PROVIDER_UNAVAILABLE/,
  );
});

test("payOS creates a server-only REST request signed over exactly five fields", () => {
  const request = gateway().prepareCheckout(quote, now);
  assert.equal(
    request.url,
    "https://api-merchant.payos.vn/v2/payment-requests",
  );
  assert.equal(request.method, "POST");
  assert.equal(request.body.orderCode, 123);
  assert.equal(request.body.amount, 3000);
  assert.equal(request.body.expiredAt, 1792029600);
  const canonical = `amount=3000&cancelUrl=${env.PAYOS_CANCEL_URL}&description=SH CREDIT&orderCode=123&returnUrl=${env.PAYOS_RETURN_URL}`;
  assert.equal(
    request.body.signature,
    createHmac("sha256", checksum).update(canonical).digest("hex"),
  );
  for (const secret of [checksum, env.PAYOS_API_KEY])
    assert.ok(!JSON.stringify(request).includes(secret));
  for (const orderCode of [
    "0",
    "00123",
    "-1",
    "1.2",
    "9007199254740992",
    "123&amount=1",
  ])
    assert.throws(
      () => gateway().prepareCheckout({ ...quote, orderCode }, now),
      /INVALID_PAYMENT_REFERENCE/,
    );
  for (const expiresAt of [
    now,
    new Date("invalid"),
    new Date(now.getTime() + 3600001),
    new Date("2040-01-01"),
  ])
    assert.throws(
      () => gateway().prepareCheckout({ ...quote, expiresAt }, now),
      /INVALID_PAYMENT_EXPIRY/,
    );
  assert.throws(() =>
    gateway().prepareCheckout({ ...quote, paymentAmountVnd: 1001n }, now),
  );
});

test("webhook verification matches the official payOS golden signature before stripping PII", () => {
  const event = gateway().verifyWebhook(payload());
  assert.equal(event.gateway, "PAYOS");
  assert.equal(event.amountVnd, "3000");
  assert.equal(event.orderCode, "123");
  assert.equal(event.outcome, "PAID");
  assert.equal(event.transactionId, "TF230204212323");
  assert.ok(!JSON.stringify(event).includes("12345678"));
  assert.ok(!("accountNumber" in event));
  for (const key of [
    "amount",
    "orderCode",
    "accountNumber",
    "reference",
    "paymentLinkId",
  ]) {
    const tampered = payload();
    tampered.data[key] =
      typeof tampered.data[key] === "number"
        ? tampered.data[key] + 1
        : "tampered";
    assert.throws(
      () => gateway().verifyWebhook(tampered),
      /PAYMENT_SIGNATURE_INVALID/,
    );
  }
  assert.throws(
    () => gateway().verifyWebhook({ ...payload(), signature: "0".repeat(64) }),
    /PAYMENT_SIGNATURE_INVALID/,
  );
  for (const signature of [undefined, "", "xyz", "a".repeat(63)])
    assert.throws(
      () => gateway().verifyWebhook({ ...payload(), signature }),
      /INVALID_PAYMENT_PROVIDER_PAYLOAD/,
    );
});

test("retries keep business identity, changed signed evidence conflicts, unknown outcomes require review", () => {
  const first = gateway().verifyWebhook(payload());
  const repeated = {
    ...payload(),
    timestamp: 123,
    desc: "delivery description",
  };
  assert.equal(
    first.businessDigest,
    gateway().verifyWebhook(repeated).businessDigest,
  );
  assert.equal(first.eventKey, gateway().verifyWebhook(repeated).eventKey);
  const changed = payload();
  changed.data.orderCode = 124;
  const other = gateway().verifyWebhook(sign(changed));
  assert.equal(first.eventKey, other.eventKey);
  assert.notEqual(first.businessDigest, other.businessDigest);
  for (const patch of [{ code: "99" }, { currency: "USD" }]) {
    const body = payload();
    Object.assign(body.data, patch);
    assert.equal(gateway().verifyWebhook(sign(body)).outcome, "REVIEW");
  }
  assert.equal(
    gateway().verifyWebhook({ ...payload(), success: false }).outcome,
    "REVIEW",
  );
  assert.equal(
    gateway().verifyWebhook({ ...payload(), code: "99" }).outcome,
    "REVIEW",
  );
});

test("canonical signature retains unknown scalar fields and handles null without persisting them", () => {
  const body = payload();
  body.data.extra = null;
  const first = gateway().verifyWebhook(sign(body));
  body.data.extra = "null";
  const second = gateway().verifyWebhook(sign(body));
  assert.equal(first.businessDigest, second.businessDigest);
  assert.ok(!("extra" in second));
  const unsafe = payload();
  unsafe.data.amount = Number.MAX_SAFE_INTEGER + 1;
  assert.throws(
    () => gateway().verifyWebhook(sign(unsafe)),
    /INVALID_PAYMENT_PROVIDER_PAYLOAD/,
  );
  const nested = payload();
  nested.data.extra = { unhandled: true };
  assert.throws(
    () => gateway().verifyWebhook(sign(nested)),
    /INVALID_PAYMENT_PROVIDER_PAYLOAD/,
  );
});

test("signed checkout response must match the reserved quote and approved payOS origin", () => {
  const checkout = gateway().verifyCheckoutResponse(response(), quote);
  assert.equal(checkout.method, "GET");
  assert.equal(checkout.url, "https://pay.payos.vn/web/provider-link");
  assert.equal(checkout.paymentLinkId, "provider-link");
  assert.ok(!JSON.stringify(checkout).includes("signature"));
  const tampered = response();
  tampered.data.amount = 5000;
  assert.throws(
    () => gateway().verifyCheckoutResponse(tampered, quote),
    /PAYMENT_SIGNATURE_INVALID/,
  );
  for (const patch of [
    { orderCode: 124 },
    { amount: 5000 },
    { currency: "USD" },
    { status: "UNKNOWN" },
    { checkoutUrl: "invalid-url" },
    { checkoutUrl: "https://evil.invalid" },
    { checkoutUrl: "https://pay.payos.vn.evil.invalid/web/link" },
  ]) {
    const body = response();
    Object.assign(body.data, patch);
    assert.throws(
      () => gateway().verifyCheckoutResponse(sign(body), quote),
      /PAYMENT_CHECKOUT_MISMATCH/,
    );
  }
});
