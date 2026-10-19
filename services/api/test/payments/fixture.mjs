import "reflect-metadata";
import { createHmac, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { ConfigService } from "@nestjs/config";
import { createCreditFixture } from "../credit/fixture.mjs";
import { PayosTransport } from "../../dist/modules/payments/infrastructure/payos-transport.js";
import { PaymentCheckoutWorker } from "../../dist/modules/payments/application/services/payment-checkout.worker.js";
import { PaymentReceiptsService } from "../../dist/modules/payments/application/services/payment-receipts.service.js";
import { PaymentCreationPolicy } from "../../dist/modules/payments/application/services/payment-creation-policy.js";
import { CreatePaymentUseCase } from "../../dist/modules/payments/application/use-cases/create-payment.use-case.js";
import { CancelPaymentUseCase } from "../../dist/modules/payments/application/use-cases/cancel-payment.use-case.js";
import {
  ReadPaymentsUseCase,
  PaymentCursor,
} from "../../dist/modules/payments/application/use-cases/read-payments.use-case.js";
import { CreditOperationsService } from "../../dist/modules/credit/application/services/credit-operations.service.js";
import { CreditProvenanceService } from "../../dist/modules/credit/application/services/credit-provenance.service.js";
import { ApplicationEventsService } from "../../dist/modules/application-events/application/application-events.service.js";
import { eventSettings } from "../../dist/modules/application-events/domain/event-config.js";

export const env = {
  PAYMENTS_ENABLED: "true",
  PAYOS_CLIENT_ID: "fixture-merchant",
  PAYOS_API_KEY: "fixture-api-key",
  PAYOS_CHECKSUM_KEY: "fixture-checksum-key",
  PAYOS_RETURN_URL: "https://fixture.invalid/api/health",
  PAYOS_CANCEL_URL: "https://fixture.invalid/api/health",
};
export function sign(data, extra = {}) {
  const canonical = Object.keys(data)
    .sort((a, b) => (a < b ? -1 : Number(a > b)))
    .map((key) => {
      let value = data[key];
      if (Array.isArray(value))
        value = JSON.stringify(
          value.map((row) =>
            Object.fromEntries(
              Object.keys(row)
                .sort((a, b) => (a < b ? -1 : Number(a > b)))
                .map((name) => [name, row[name]]),
            ),
          ),
        );
      return `${key}=${[null, "null", "undefined"].includes(value) ? "" : value}`;
    })
    .join("&");
  return {
    code: "00",
    success: true,
    ...extra,
    data,
    signature: createHmac("sha256", env.PAYOS_CHECKSUM_KEY)
      .update(canonical)
      .digest("hex"),
  };
}
export async function createPaymentFixture() {
  const f = await createCreditFixture();
  const subscriber = Object.assign(new EventEmitter(), {
    connect: async () => {},
    subscribe: async () => {},
    disconnect() {},
  });
  const redis = { duplicate: () => subscriber, publish: async () => {} };
  const events = new ApplicationEventsService(
    f.db,
    f.transactions,
    redis,
    f.registry,
    f.actors,
    { values: eventSettings({ secret: "fixture-cursor-key".repeat(3) }) },
  );
  const transport = new PayosTransport(new ConfigService(env));
  const provenance = new CreditProvenanceService();
  const credit = new CreditOperationsService(provenance);
  const receipts = new PaymentReceiptsService(
    f.transactions,
    transport,
    credit,
    f.audit,
    events,
  );
  const worker = new PaymentCheckoutWorker(
    f.db,
    f.transactions,
    transport,
    receipts,
    events,
  );
  const policy = new PaymentCreationPolicy(transport);
  const reads = new ReadPaymentsUseCase(
    f.transactions,
    f.actors,
    new PaymentCursor("fixture-payment-cursor"),
    transport,
    policy,
  );
  const create = new CreatePaymentUseCase(
    f.commands,
    f.actors,
    credit,
    transport,
    worker,
    reads,
    policy,
  );
  const cancel = new CancelPaymentUseCase(f.commands, f.actors, worker, reads);
  const providerOrders = new Map();
  const requests = [];
  const originalFetch = globalThis.fetch;
  let failCreate = 0,
    failLookup = 0,
    failCancel = 0,
    afterCreate,
    beforeCancel;
  globalThis.fetch = async (url, options) => {
    if (!String(url).startsWith("https://api-merchant.payos.vn/"))
      return originalFetch(url, options);
    requests.push({ url: String(url), ...options });
    if (String(url).endsWith("/cancel")) {
      const orderCode = String(url).split("/").at(-2);
      const order = providerOrders.get(orderCode);
      if (!order) return Response.json({ code: "not-found" });
      if (beforeCancel) await beforeCancel(order);
      if (order.status === "PENDING" && order.amountPaid === 0)
        order.status = "CANCELLED";
      if (failCancel-- > 0) throw new Error("injected-after-provider-cancel");
      return Response.json(sign(order));
    }
    if (options.method === "POST") {
      const input = JSON.parse(options.body);
      const existing = providerOrders.get(String(input.orderCode));
      if (existing) return Response.json({ code: "duplicate-order" });
      const order = {
        id: randomUUID(),
        orderCode: input.orderCode,
        amount: input.amount,
        amountPaid: 0,
        amountRemaining: input.amount,
        status: "PENDING",
        transactions: [],
      };
      providerOrders.set(String(order.orderCode), order);
      if (failCreate-- > 0) throw new Error("injected-after-provider-create");
      if (afterCreate) await afterCreate(order);
      return Response.json(
        sign({
          orderCode: order.orderCode,
          amount: order.amount,
          paymentLinkId: order.id,
          currency: "VND",
          status: "PENDING",
          qrCode: `qr:${order.id}`,
          checkoutUrl: `https://pay.payos.vn/web/${order.id}`,
          accountNumber: "private-fixture",
        }),
      );
    }
    if (failLookup-- > 0) throw new Error("lookup temporarily unavailable");
    const order = providerOrders.get(String(url).split("/").at(-1));
    return Response.json(order ? sign(order) : { code: "not-found" });
  };
  async function order(account, amount = "100000", key = randomUUID()) {
    return (
      await create.execute(f.command(account, key), {
        paymentAmountVnd: amount,
        gateway: "PAYOS",
      })
    ).data;
  }
  async function webhook(payment, overrides = {}) {
    const checkout = await f.db.payosCheckout.findUniqueOrThrow({
      where: { paymentId: payment.id },
    });
    const provider = providerOrders.get(checkout.orderCode.toString());
    return sign({
      orderCode: Number(checkout.orderCode),
      amount: Number(payment.paymentAmountVnd),
      paymentLinkId: provider?.id ?? `link-${payment.id}`,
      currency: "VND",
      code: "00",
      reference: randomUUID(),
      transactionDateTime: new Date().toISOString(),
      accountNumber: "private-account",
      ...overrides,
    });
  }
  async function due(paymentId) {
    await f.db.payosCheckout.update({
      where: { paymentId },
      data: { nextAttemptAt: new Date(0), leaseUntil: null },
    });
  }
  return {
    ...f,
    events,
    transport,
    provenance,
    credit,
    receipts,
    worker,
    reads,
    policy,
    create,
    cancel,
    order,
    webhook,
    due,
    providerOrders,
    requests,
    set failCreate(value) {
      failCreate = value;
    },
    set failLookup(value) {
      failLookup = value;
    },
    set failCancel(value) {
      failCancel = value;
    },
    set beforeCancel(value) {
      beforeCancel = value;
    },
    set afterCreate(value) {
      afterCreate = value;
    },
    dispose: async () => {
      worker.onModuleDestroy();
      events.onModuleDestroy();
      globalThis.fetch = originalFetch;
      await f.dispose();
    },
  };
}
