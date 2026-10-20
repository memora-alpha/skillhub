import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigService } from "@nestjs/config";
import { PayosTransport } from "../../dist/modules/payments/infrastructure/gateway/payos-transport.js";
import { env, sign } from "./fixture.mjs";

test("payOS transport fixes origin, bounds responses/deadlines and authenticates nested lookup evidence", async () => {
  const transport = new PayosTransport(new ConfigService(env));
  const quote = {
    orderCode: "123",
    paymentAmountVnd: 1000n,
    expiresAt: new Date(Date.now() + 3500000),
  };
  const lookup = {
    id: "provider-link",
    orderCode: 123,
    amount: 1000,
    amountPaid: 1000,
    amountRemaining: 0,
    status: "PAID",
    transactions: [
      {
        reference: "bank-reference",
        amount: 1000,
        transactionDateTime: "2026-10-17 08:00:00",
        counterAccountName: "private-name",
      },
    ],
  };
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(
        url,
        "https://api-merchant.payos.vn/v2/payment-requests/123",
      );
      assert.equal(options.redirect, "error");
      assert.equal(options.headers["x-client-id"], env.PAYOS_CLIENT_ID);
      assert.equal(options.headers["x-api-key"], env.PAYOS_API_KEY);
      assert.ok(options.signal);
      return Response.json(sign(lookup));
    };
    const result = await transport.lookup(quote);
    assert.equal(result.exact, true);
    assert.equal(
      result.events[0].transactionDateTime,
      "2026-10-17T01:00:00.000Z",
    );
    assert.doesNotMatch(JSON.stringify(result), /private-name/);
    const signed = sign(lookup);
    globalThis.fetch = async () =>
      Response.json({
        ...signed,
        data: {
          ...lookup,
          transactions: [{ ...lookup.transactions[0], amount: 2000 }],
        },
      });
    await assert.rejects(transport.lookup(quote), /PAYMENT_SIGNATURE_INVALID/);
    globalThis.fetch = async () => new Response("x".repeat(131073));
    await assert.rejects(
      transport.lookup(quote),
      /PAYMENT_PROVIDER_UNAVAILABLE/,
    );
    globalThis.fetch = async () =>
      new Response("provider secret error", { status: 500 });
    await assert.rejects(
      transport.lookup(quote),
      /PAYMENT_PROVIDER_UNAVAILABLE/,
    );
    globalThis.fetch = async (_url, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("timeout")), {
          once: true,
        }),
      );
    await assert.rejects(
      transport.lookup(quote),
      /PAYMENT_PROVIDER_UNAVAILABLE/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("payOS cancel uses fixed authenticated POST and verifies signature, quote and payment evidence", async () => {
  const transport = new PayosTransport(new ConfigService(env));
  const quote = {
    orderCode: "123",
    paymentAmountVnd: 1000n,
    expiresAt: new Date(),
  };
  const data = {
    id: "provider-link",
    orderCode: 123,
    amount: 1000,
    amountPaid: 0,
    amountRemaining: 1000,
    status: "CANCELLED",
    transactions: [],
  };
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(
        url,
        "https://api-merchant.payos.vn/v2/payment-requests/123/cancel",
      );
      assert.equal(options.method, "POST");
      assert.equal(options.redirect, "error");
      assert.equal(options.headers["x-client-id"], env.PAYOS_CLIENT_ID);
      assert.equal(options.headers["x-api-key"], env.PAYOS_API_KEY);
      assert.deepEqual(JSON.parse(options.body), {
        cancellationReason: "User requested cancellation",
      });
      return Response.json(sign(data));
    };
    assert.equal((await transport.cancel(quote)).status, "CANCELLED");
    assert.equal((await transport.cancel(quote)).hasPayment, false);
    const signed = sign(data);
    globalThis.fetch = async () =>
      Response.json({ ...signed, data: { ...data, status: "PAID" } });
    await assert.rejects(transport.cancel(quote), /PAYMENT_SIGNATURE_INVALID/);
    globalThis.fetch = async () =>
      Response.json(sign({ ...data, orderCode: 124 }));
    await assert.rejects(transport.cancel(quote), /PAYMENT_LOOKUP_MISMATCH/);
    globalThis.fetch = async () =>
      Response.json(sign({ ...data, amount: 2000 }));
    await assert.rejects(transport.cancel(quote), /PAYMENT_LOOKUP_MISMATCH/);
    globalThis.fetch = async () =>
      Response.json(sign({ ...data, transactions: null }));
    await assert.rejects(transport.cancel(quote), /INVALID_PAYMENT_LOOKUP/);
    globalThis.fetch = async () =>
      Response.json({ code: "payment-paid", desc: "private-provider-message" });
    await assert.rejects(
      transport.cancel(quote),
      /PAYMENT_PROVIDER_UNAVAILABLE/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
