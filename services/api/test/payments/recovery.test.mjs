import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import { PaymentCheckoutWorker } from "../../dist/modules/payments/infrastructure/jobs/payment-checkout.worker.js";
import { quoteDigest } from "../../dist/modules/payments/application/services/payment-receipts.service.js";
import { createPaymentFixture } from "./fixture.mjs";

test("technical checkout recovery closes unpaid orders without losing financial evidence", async (t) => {
  const f = await createPaymentFixture();
  const checkoutFor = (payment) =>
    f.db.payosCheckout.findUniqueOrThrow({ where: { paymentId: payment.id } });
  const providerFor = async (payment) =>
    f.providerOrders.get((await checkoutFor(payment)).orderCode.toString());
  const view = (owner, payment) => f.reads.detail(owner.principal, payment.id);
  const markReview = (payment, reason = "PAYMENT_QR_UNAVAILABLE") =>
    f.transactions.run((tx) => f.receipts.review(tx, payment.id, reason));
  const recover = async (payment) => {
    await f.due(payment.id);
    await f.worker.process(payment.id);
  };
  const pay = async (payment, amount) => {
    const provider = await providerFor(payment);
    Object.assign(provider, {
      status: "PAID",
      amountPaid: amount ?? provider.amount,
      amountRemaining: amount === undefined ? 0 : provider.amount - amount,
      transactions: [
        {
          reference: randomUUID(),
          amount: amount ?? provider.amount,
          transactionDateTime: new Date().toISOString(),
        },
      ],
    });
  };
  try {
    await t.test(
      "lost create response is safely cancelled; original-key replay and mapping repair never replace it",
      async () => {
        const owner = await f.account(),
          key = randomUUID();
        f.failCreate = 1;
        const payment = await f.order(owner, "100000", key);
        assert.equal(payment.status, "CREATED");
        assert.equal(payment.recoveryReason, "PAYMENT_RECOVERY_PENDING");
        await recover(payment);
        assert.equal((await view(owner, payment)).status, "CANCELLED");
        assert.equal(
          (await f.reads.creationPolicy(owner.principal)).canCreate,
          true,
        );
        const requests = f.requests.length;
        await f.db.idempotencyRecord.deleteMany({
          where: { scope: owner.user.id, operation: "payment:create" },
        });
        assert.equal((await f.order(owner, "100000", key)).id, payment.id);
        assert.equal(f.requests.length, requests);
        assert.notEqual((await f.order(owner)).id, payment.id);
      },
    );
    await t.test(
      "more than five network failures keep durable retries and eventually recover after restart",
      async () => {
        const owner = await f.account();
        f.failCreate = 1;
        const payment = await f.order(owner);
        f.failLookup = 7;
        for (let n = 0; n < 7; n++) await recover(payment);
        const waiting = await view(owner, payment);
        assert.equal(waiting.status, "CREATED");
        assert.equal(waiting.recoveryReason, "PAYMENT_RECOVERY_PENDING");
        assert.equal((await checkoutFor(payment)).state, "PREPARING");
        assert.equal(
          (await f.reads.creationPolicy(owner.principal)).canCreate,
          false,
        );
        const resumed = new PaymentCheckoutWorker(
          f.db,
          f.transactions,
          f.transport,
          f.receipts,
          f.events,
        );
        await f.due(payment.id);
        await resumed.recover();
        assert.equal((await view(owner, payment)).status, "CANCELLED");
      },
    );
    await t.test(
      "timeout after automatic cancellation stays unresolved until signed lookup confirms closure",
      async () => {
        const owner = await f.account();
        f.failCreate = 1;
        const payment = await f.order(owner);
        f.failCancel = 1;
        await recover(payment);
        assert.equal((await view(owner, payment)).status, "CREATED");
        assert.equal(
          (await f.reads.creationPolicy(owner.principal)).canCreate,
          false,
        );
        assert.equal((await providerFor(payment)).status, "CANCELLED");
        await recover(payment);
        assert.equal((await view(owner, payment)).status, "CANCELLED");
      },
    );
    await t.test(
      "both legacy technical review reasons are recovered by the scheduled worker with an audit trail",
      async () => {
        for (const reason of [
          "PAYMENT_QR_UNAVAILABLE",
          "PAYMENT_PROVIDER_RETRY_EXHAUSTED",
        ]) {
          const owner = await f.account(),
            payment = await f.order(owner);
          const before = await checkoutFor(payment);
          await markReview(payment, reason);
          await f.due(payment.id);
          await f.worker.recover();
          assert.equal((await view(owner, payment)).status, "CANCELLED");
          const after = await checkoutFor(payment);
          assert.equal(after.orderCode, before.orderCode);
          assert.equal(after.expiresAt.getTime(), before.expiresAt.getTime());
          assert.equal(
            (await f.reads.creationPolicy(owner.principal)).canCreate,
            true,
          );
          const audits = await f.db.auditLog.findMany({
            where: { action: "PAYMENT_RECOVERY_RESUME", targetId: payment.id },
          });
          assert.equal(audits.length, 1);
          assert.equal(audits[0].before.reasonCode, reason);
        }
      },
    );
    await t.test(
      "legacy technical REVIEW with exact paid evidence posts once instead of cancelling",
      async () => {
        const owner = await f.account(),
          payment = await f.order(owner);
        await markReview(payment);
        await pay(payment);
        const before = f.requests.length;
        await recover(payment);
        assert.equal((await view(owner, payment)).status, "PAID");
        assert.equal(
          f.requests
            .slice(before)
            .some((request) => request.url.endsWith("/cancel")),
          false,
        );
        await recover(payment);
        assert.equal(
          await f.db.creditTransaction.count({
            where: { userId: owner.user.id },
          }),
          1,
        );
      },
    );
    await t.test(
      "legacy review retries network errors without reopening and stops on invalid signed evidence",
      async () => {
        const owner = await f.account(),
          payment = await f.order(owner);
        await markReview(payment);
        f.failLookup = 1;
        await recover(payment);
        assert.equal((await view(owner, payment)).status, "REVIEW");
        assert.equal(
          (await checkoutFor(payment)).lastError,
          "PAYMENT_QR_UNAVAILABLE",
        );
        const lookup = f.transport.lookup;
        f.transport.lookup = async () => {
          throw new UnauthorizedException("PAYMENT_SIGNATURE_INVALID");
        };
        try {
          await recover(payment);
        } finally {
          f.transport.lookup = lookup;
        }
        assert.equal(
          (await checkoutFor(payment)).lastError,
          "PAYMENT_PROVIDER_EVIDENCE_INVALID",
        );
        const before = f.requests.length;
        await recover(payment);
        assert.equal(f.requests.length, before);
      },
    );
    await t.test(
      "financial reviews and technical reviews with any receipt stay blocked",
      async () => {
        const owner = await f.account(),
          payment = await f.order(owner);
        await markReview(payment, "PAYMENT_AMOUNT_MISMATCH");
        const before = f.requests.length;
        await recover(payment);
        assert.equal(f.requests.length, before);
        assert.equal((await view(owner, payment)).status, "REVIEW");
        const other = await f.account(),
          technical = await f.order(other);
        await markReview(technical);
        await f.db.paymentReceipt.create({
          data: {
            id: randomUUID(),
            channel: f.transport.config.PAYOS_CLIENT_ID,
            transactionId: randomUUID(),
            digest: "a".repeat(64),
            evidence: {},
            paymentId: technical.id,
            state: "REVIEW",
            reason: "PAYMENT_AMOUNT_MISMATCH",
          },
        });
        await recover(technical);
        assert.equal(
          (await checkoutFor(technical)).lastError,
          "PAYMENT_RECONCILIATION_REQUIRED",
        );
        assert.equal((await view(other, technical)).status, "REVIEW");
        assert.equal(f.requests.length, before + 1); // Only the other owner's original create.
      },
    );
    await t.test(
      "partial payment and PROCESSING never trigger automatic cancellation",
      async () => {
        const owner = await f.account(),
          payment = await f.order(owner);
        await markReview(payment);
        await pay(payment, 1000);
        let before = f.requests.length;
        await recover(payment);
        assert.equal((await view(owner, payment)).status, "REVIEW");
        assert.equal(
          f.requests
            .slice(before)
            .some((request) => request.url.endsWith("/cancel")),
          false,
        );
        const other = await f.account(),
          processing = await f.order(other);
        (await providerFor(processing)).status = "PROCESSING";
        before = f.requests.length;
        await recover(processing);
        const current = await view(other, processing);
        assert.equal(current.status, "PENDING");
        assert.equal(current.recoveryReason, "PAYMENT_RECOVERY_PENDING");
        assert.equal(current.checkout, null);
        assert.equal(f.requests.length, before + 1);
      },
    );
    await t.test(
      "local expiry alone does not close an order while cancellation remains unconfirmed",
      async () => {
        const owner = await f.account(),
          payment = await f.order(owner);
        const record = await f.db.payment.findUniqueOrThrow({
          where: { id: payment.id },
        });
        const checkout = await checkoutFor(payment);
        const expiresAt = new Date(Date.now() - 1000);
        await f.db.payosCheckout.update({
          where: { paymentId: payment.id },
          data: {
            expiresAt,
            quoteDigest: quoteDigest(record, { ...checkout, expiresAt }),
          },
        });
        f.failCancel = 1;
        await recover(payment);
        assert.equal((await view(owner, payment)).status, "PENDING");
        assert.equal(
          (await f.reads.creationPolicy(owner.principal)).canCreate,
          false,
        );
        await recover(payment);
        assert.equal((await view(owner, payment)).status, "CANCELLED");
      },
    );
    await t.test(
      "webhook racing with automatic cancellation preserves PAID and exactly one top-up",
      async () => {
        const owner = await f.account();
        f.failCreate = 1;
        const payment = await f.order(owner);
        const payload = await f.webhook(payment);
        f.beforeCancel = async () => {
          await f.receipts.webhook(payload);
        };
        try {
          await recover(payment);
        } finally {
          f.beforeCancel = undefined;
        }
        await f.receipts.webhook(payload);
        assert.equal((await view(owner, payment)).status, "PAID");
        assert.equal(
          await f.db.creditTransaction.count({
            where: { userId: owner.user.id },
          }),
          1,
        );
      },
    );
    await t.test(
      "stale lookup holder cannot reopen a technical review or cancel its order",
      async () => {
        const owner = await f.account(),
          payment = await f.order(owner);
        await markReview(payment);
        const lookup = f.transport.lookup;
        f.transport.lookup = async (quote) => {
          const result = await lookup.call(f.transport, quote);
          await f.db.payosCheckout.update({
            where: { paymentId: payment.id },
            data: { leaseToken: randomUUID() },
          });
          return result;
        };
        const before = f.requests.length;
        try {
          await recover(payment);
        } finally {
          f.transport.lookup = lookup;
        }
        assert.equal((await view(owner, payment)).status, "REVIEW");
        assert.equal(f.requests.length, before + 1);
        await recover(payment);
        assert.equal((await view(owner, payment)).status, "CANCELLED");
        assert.equal(
          JSON.parse(f.requests.at(-1).body).cancellationReason,
          "Checkout recovery: QR unavailable or expired",
        );
      },
    );
    await t.test(
      "audit failure rolls back legacy review reopening and permits safe retry",
      async () => {
        const owner = await f.account(),
          payment = await f.order(owner);
        await markReview(payment);
        const append = f.audit.append;
        f.audit.append = async () => {
          throw new Error("injected-audit-failure");
        };
        try {
          await recover(payment);
        } finally {
          f.audit.append = append;
        }
        assert.equal((await view(owner, payment)).status, "REVIEW");
        assert.equal((await checkoutFor(payment)).state, "REVIEW");
        await recover(payment);
        assert.equal((await view(owner, payment)).status, "CANCELLED");
      },
    );
    await t.test(
      "receipt arrival during lookup prevents legacy review reopening",
      async () => {
        const owner = await f.account(),
          payment = await f.order(owner);
        await markReview(payment);
        const lookup = f.transport.lookup;
        f.transport.lookup = async (quote) => {
          const result = await lookup.call(f.transport, quote);
          await f.receipts.webhook(await f.webhook(payment));
          return result;
        };
        const before = f.requests.length;
        try {
          await recover(payment);
        } finally {
          f.transport.lookup = lookup;
        }
        assert.equal((await view(owner, payment)).status, "REVIEW");
        assert.equal(f.requests.length, before + 1);
        assert.equal(
          await f.db.creditTransaction.count({
            where: { userId: owner.user.id },
          }),
          0,
        );
      },
    );
  } finally {
    await f.dispose();
  }
});
