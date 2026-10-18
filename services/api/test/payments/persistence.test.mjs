import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PaymentReceiptsService } from "../../dist/modules/payments/application/services/payment-receipts.service.js";
import { PaymentCheckoutWorker } from "../../dist/modules/payments/application/services/payment-checkout.worker.js";
import { createPaymentFixture, sign } from "./fixture.mjs";

test("payOS durable orders, posting, conflicts, rollback and recovery on real PostgreSQL", async (t) => {
  const f = await createPaymentFixture();
  try {
    const owner = await f.account(),
      other = await f.account();
    let payment;
    await t.test(
      "idempotent create binds actor and quote; QR projection excludes private provider fields",
      async () => {
        const key = randomUUID();
        const command = f.command(owner, key),
          body = { paymentAmountVnd: "100000", gateway: "PAYOS" };
        const first = await f.create.execute(command, body),
          second = await f.create.execute(command, body);
        payment = first.data;
        assert.equal(first.replayed, false);
        assert.equal(second.replayed, true);
        assert.equal(first.data.id, second.data.id);
        assert.equal(payment.creditAmount, "100.00");
        assert.equal(payment.status, "PENDING");
        assert.ok(payment.checkout.qrCode);
        assert.doesNotMatch(
          JSON.stringify(payment),
          /checkoutUrl|private-fixture|signature|api-key/,
        );
        assert.equal(f.requests.length, 1);
        await assert.rejects(
          f.create.execute(command, { ...body, paymentAmountVnd: "200000" }),
          /different command/,
        );
        await assert.rejects(
          f.reads.detail(other.principal, payment.id),
          /PAYMENT_NOT_FOUND/,
        );
      },
    );
    await t.test(
      "simultaneous duplicate webhooks issue one TOP_UP, purchased lot, audit and durable wallet event",
      async () => {
        const payload = await f.webhook(payment);
        await Promise.all(
          Array.from({ length: 3 }, () => f.receipts.webhook(payload)),
        );
        const wallet = await f.db.creditWallet.findUniqueOrThrow({
          where: { userId: owner.user.id },
        });
        assert.equal(wallet.availableCredit, 10000n);
        assert.equal(wallet.purchasedCredit, 10000n);
        assert.equal(wallet.walletVersion, 1);
        assert.equal(wallet.lastEntrySequence, 1n);
        assert.equal(
          await f.db.creditTransaction.count({
            where: { userId: owner.user.id },
          }),
          1,
        );
        assert.equal(
          await f.db.creditLot.count({ where: { userId: owner.user.id } }),
          1,
        );
        assert.equal(
          await f.db.auditLog.count({
            where: { action: "CREDIT_TOP_UP", targetId: payment.id },
          }),
          1,
        );
        const event = await f.db.userEventDelivery.findFirstOrThrow({
          where: { userId: owner.user.id, type: "wallet.updated" },
        });
        assert.deepEqual(Object.keys(event.payload).sort(), [
          "operationId",
          "walletUserId",
        ]);
        assert.equal(await f.events.visible(owner.principal, event), true);
        assert.equal(await f.events.visible(other.principal, event), false);
        assert.equal(
          (await f.reads.detail(owner.principal, payment.id)).checkout,
          null,
        );
        assert.ok(
          await f.db.outboxEvent.findFirst({
            where: { type: "application.events.wakeup" },
          }),
        );
        const tampered = sign({ ...payload.data, amount: 200000 });
        await f.receipts.webhook(tampered);
        assert.equal(
          (await f.db.payment.findUniqueOrThrow({ where: { id: payment.id } }))
            .status,
          "PAID",
        );
        assert.equal(
          (
            await f.db.paymentReceipt.findFirstOrThrow({
              where: { paymentId: payment.id },
            })
          ).conflict,
          true,
        );
      },
    );
    await t.test(
      "invalid signatures never persist; unknown/sample and partial/late/mismatched links retain REVIEW without issuing",
      async () => {
        const unknown = sign({
          orderCode: 123,
          amount: 1000,
          paymentLinkId: "sample",
          reference: "sample-ref",
          code: "00",
          currency: "VND",
          transactionDateTime: new Date().toISOString(),
        });
        await assert.rejects(
          f.receipts.webhook({ ...unknown, signature: "0".repeat(64) }),
          /PAYMENT_SIGNATURE_INVALID/,
        );
        await f.receipts.webhook(unknown);
        assert.equal(
          (
            await f.db.paymentReceipt.findUniqueOrThrow({
              where: {
                channel_transactionId: {
                  channel: "fixture-merchant",
                  transactionId: "sample-ref",
                },
              },
            })
          ).state,
          "REVIEW",
        );
        for (const overrides of [
          { amount: 999 },
          { paymentLinkId: "wrong-link" },
          { transactionDateTime: new Date(Date.now() + 3700000).toISOString() },
          { currency: "USD" },
          { transactionDateTime: "2026-02-31 00:00:00" },
        ]) {
          const account = await f.account(),
            pending = await f.order(account);
          await f.receipts.webhook(await f.webhook(pending, overrides));
          assert.equal(
            (await f.reads.detail(account.principal, pending.id)).status,
            "REVIEW",
          );
          assert.equal(
            await f.db.creditLot.count({ where: { userId: account.user.id } }),
            0,
          );
        }
      },
    );
    await t.test(
      "audit failure rolls back receipt, payment, lot, ledger, balance and stream; retry succeeds",
      async () => {
        const account = await f.account(),
          pending = await f.order(account),
          payload = await f.webhook(pending);
        const failing = new PaymentReceiptsService(
          f.transactions,
          f.transport,
          f.credit,
          {
            append: async () => {
              throw new Error("audit unavailable");
            },
          },
          f.events,
        );
        const streamBefore = await f.db.userEventDelivery.count({
          where: { userId: account.user.id },
        });
        await assert.rejects(failing.webhook(payload), /audit unavailable/);
        assert.equal(
          (await f.reads.detail(account.principal, pending.id)).status,
          "PENDING",
        );
        assert.equal(
          await f.db.paymentReceipt.count({ where: { paymentId: pending.id } }),
          0,
        );
        assert.equal(
          await f.db.creditTransaction.count({
            where: { userId: account.user.id },
          }),
          0,
        );
        assert.equal(
          await f.db.creditLot.count({ where: { userId: account.user.id } }),
          0,
        );
        assert.equal(
          await f.db.userEventDelivery.count({
            where: { userId: account.user.id },
          }),
          streamBefore,
        );
        await f.receipts.webhook(payload);
        assert.equal(
          (await f.reads.detail(account.principal, pending.id)).status,
          "PAID",
        );
      },
    );
    await t.test(
      "provider create timeout recovers the same persisted order and posts from signed lookup when webhook is lost",
      async () => {
        const account = await f.account();
        f.failCreate = 1;
        const pending = await f.order(account),
          checkout = await f.db.payosCheckout.findUniqueOrThrow({
            where: { paymentId: pending.id },
          });
        assert.equal(pending.status, "CREATED");
        assert.equal(pending.checkout, null);
        const provider = f.providerOrders.get(checkout.orderCode.toString());
        const payload = await f.webhook(pending);
        Object.assign(provider, {
          status: "PAID",
          amountPaid: provider.amount,
          amountRemaining: 0,
          transactions: [
            {
              reference: payload.data.reference,
              amount: provider.amount,
              transactionDateTime: payload.data.transactionDateTime,
            },
          ],
        });
        await f.due(pending.id);
        await f.worker.process(pending.id);
        assert.equal(
          (await f.reads.detail(account.principal, pending.id)).status,
          "PAID",
        );
        await f.receipts.webhook(payload);
        assert.equal(
          await f.db.creditTransaction.count({
            where: { userId: account.user.id },
          }),
          1,
        );
      },
    );
    await t.test(
      "webhook before create response cannot be overwritten back to PENDING",
      async () => {
        const account = await f.account();
        f.afterCreate = async (provider) => {
          const checkout = await f.db.payosCheckout.findUniqueOrThrow({
            where: { orderCode: BigInt(provider.orderCode) },
          });
          const pending = await f.reads.detail(
            account.principal,
            checkout.paymentId,
          );
          await f.receipts.webhook(await f.webhook(pending));
        };
        const paid = await f.order(account);
        f.afterCreate = undefined;
        assert.equal(paid.status, "PAID");
        assert.equal(paid.checkout, null);
      },
    );
    await t.test(
      "legacy funded wallets fail closed before creating a provider order",
      async () => {
        const account = await f.account();
        await f.post(account.user.id);
        const before = f.requests.length;
        await assert.rejects(
          f.order(account),
          /CREDIT_PROVENANCE_REVIEW_REQUIRED/,
        );
        assert.equal(f.requests.length, before);
      },
    );
    await t.test(
      "a restarted worker respects active leases and recovers an expired lease without another create",
      async () => {
        const account = await f.account(),
          pending = await f.order(account);
        const resumed = new PaymentCheckoutWorker(
          f.db,
          f.transactions,
          f.transport,
          f.receipts,
          f.events,
        );
        await f.db.payosCheckout.update({
          where: { paymentId: pending.id },
          data: {
            nextAttemptAt: new Date(0),
            leaseToken: randomUUID(),
            leaseUntil: new Date(Date.now() + 30000),
          },
        });
        const before = f.requests.length;
        await resumed.process(pending.id);
        assert.equal(f.requests.length, before);
        await f.db.payosCheckout.update({
          where: { paymentId: pending.id },
          data: { leaseUntil: new Date(0) },
        });
        await resumed.process(pending.id);
        assert.equal(f.requests.length, before + 1);
        assert.equal(f.requests.at(-1).method, "GET");
        assert.equal(
          (await f.reads.detail(account.principal, pending.id)).checkout.qrCode,
          pending.checkout.qrCode,
        );
      },
    );
    await t.test(
      "lost QR response with a pending provider order enters explicit review",
      async () => {
        const account = await f.account();
        f.failCreate = 1;
        const pending = await f.order(account);
        await f.due(pending.id);
        await f.worker.process(pending.id);
        assert.equal(
          (await f.reads.detail(account.principal, pending.id)).status,
          "REVIEW",
        );
        assert.equal(
          (
            await f.db.payosCheckout.findUniqueOrThrow({
              where: { paymentId: pending.id },
            })
          ).lastError,
          "PAYMENT_QR_UNAVAILABLE",
        );
      },
    );
    await t.test(
      "aggregate lookup mismatch retains authenticated receipts without posting an exact-looking individual transfer",
      async () => {
        const account = await f.account(),
          pending = await f.order(account);
        const checkout = await f.db.payosCheckout.findUniqueOrThrow({
          where: { paymentId: pending.id },
        });
        const provider = f.providerOrders.get(checkout.orderCode.toString());
        Object.assign(provider, {
          status: "PAID",
          amountPaid: 100001,
          amountRemaining: 0,
          transactions: [
            {
              reference: randomUUID(),
              amount: 100000,
              transactionDateTime: new Date().toISOString(),
            },
            {
              reference: randomUUID(),
              amount: 1,
              transactionDateTime: new Date().toISOString(),
            },
          ],
        });
        await f.due(pending.id);
        await f.worker.process(pending.id);
        assert.equal(
          (await f.reads.detail(account.principal, pending.id)).status,
          "REVIEW",
        );
        assert.equal(
          await f.db.paymentReceipt.count({
            where: { paymentId: pending.id, state: "REVIEW" },
          }),
          2,
        );
        assert.equal(
          await f.db.creditTransaction.count({
            where: { userId: account.user.id },
          }),
          0,
        );
      },
    );
    await t.test(
      "legacy concurrent payments serialize on one wallet and late webhooks survive HTTP record deletion",
      async () => {
        const account = await f.account(),
          first = await f.order(account);
        // Multiple pending intents may already exist before the creation guard rollout.
        // Bypass only the fresh-create gate in this fixture to preserve that financial race regression.
        const requireFresh = f.policy.requireFresh;
        let second;
        try {
          f.policy.requireFresh = async () => {};
          second = await f.order(account);
        } finally {
          f.policy.requireFresh = requireFresh;
        }
        const one = await f.webhook(first),
          two = await f.webhook(second);
        await Promise.all([f.receipts.webhook(one), f.receipts.webhook(two)]);
        const wallet = await f.db.creditWallet.findUniqueOrThrow({
          where: { userId: account.user.id },
        });
        assert.equal(wallet.availableCredit, 20000n);
        assert.equal(wallet.lastEntrySequence, 2n);
        await f.db.idempotencyRecord.deleteMany({
          where: { scope: account.user.id, operation: "payment:create" },
        });
        await f.receipts.webhook(one);
        await f.receipts.webhook(two);
        await f.receipts.webhook(await f.webhook(first));
        assert.equal(
          await f.db.creditTransaction.count({
            where: { userId: account.user.id },
          }),
          2,
        );
        assert.equal(
          (await f.reads.detail(account.principal, first.id)).status,
          "PAID",
        );
      },
    );
    await t.test(
      "event persistence failure rolls back audit and all monetary state",
      async () => {
        const account = await f.account(),
          pending = await f.order(account);
        const failing = new PaymentReceiptsService(
          f.transactions,
          f.transport,
          f.credit,
          f.audit,
          {
            append: async () => {
              throw new Error("stream unavailable");
            },
          },
        );
        await assert.rejects(
          failing.webhook(await f.webhook(pending)),
          /stream unavailable/,
        );
        assert.equal(
          await f.db.paymentReceipt.count({ where: { paymentId: pending.id } }),
          0,
        );
        assert.equal(
          await f.db.auditLog.count({
            where: { targetId: pending.id, action: "CREDIT_TOP_UP" },
          }),
          0,
        );
        assert.equal(
          await f.db.creditLot.count({ where: { userId: account.user.id } }),
          0,
        );
        assert.equal(
          (await f.reads.detail(account.principal, pending.id)).status,
          "PENDING",
        );
      },
    );
    await t.test(
      "keyset cursor binds actor/status and excludes newly inserted orders",
      async () => {
        const account = await f.account();
        const firstPaid = await f.order(account);
        await f.receipts.webhook(await f.webhook(firstPaid));
        const secondPaid = await f.order(account);
        await f.receipts.webhook(await f.webhook(secondPaid));
        const first = await f.reads.list(account.principal, { limit: 1 });
        assert.equal(first.pagination.hasMore, true);
        const inserted = await f.order(account);
        const next = await f.reads.list(account.principal, {
          limit: 10,
          cursor: first.pagination.nextCursor,
        });
        assert.equal(next.data.length, 1);
        assert.notEqual(next.data[0].id, inserted.id);
        await assert.rejects(
          f.reads.list(other.principal, {
            limit: 1,
            cursor: first.pagination.nextCursor,
          }),
          /INVALID_LEDGER_CURSOR/,
        );
        await assert.rejects(
          f.reads.list(account.principal, {
            limit: 1,
            cursor: first.pagination.nextCursor,
            status: "PAID",
          }),
          /INVALID_LEDGER_CURSOR/,
        );
      },
    );
  } finally {
    await f.dispose();
  }
});
