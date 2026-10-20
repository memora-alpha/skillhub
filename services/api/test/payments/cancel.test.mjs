import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createPaymentFixture } from "./fixture.mjs";

test("payment cancellation uses signed provider evidence, fenced leases and atomic state/events", async (t) => {
  const f = await createPaymentFixture();
  const cancel = (owner, payment, key = randomUUID()) =>
    f.cancel.execute(f.command(owner, key), payment.id);
  const checkoutFor = (payment) =>
    f.db.payosCheckout.findUniqueOrThrow({ where: { paymentId: payment.id } });
  const providerFor = async (payment) =>
    f.providerOrders.get((await checkoutFor(payment)).orderCode.toString());
  try {
    await t.test(
      "owner cancels, replay is stable and a fresh key can create a new top-up",
      async () => {
        const owner = await f.account(),
          other = await f.account();
        const pending = await f.order(owner),
          key = randomUUID();
        const before = f.requests.length;
        await assert.rejects(cancel(other, pending), /PAYMENT_NOT_FOUND/);
        assert.equal(f.requests.length, before);
        const result = await cancel(owner, pending, key);
        assert.equal(result.status, "CANCELLED");
        assert.equal(result.checkout, null);
        assert.equal(result.recoveryRequired, false);
        assert.equal((await checkoutFor(pending)).state, "CLOSED");
        assert.equal((await checkoutFor(pending)).leaseToken, null);
        const request = f.requests.at(-1);
        assert.equal(request.method, "POST");
        assert.match(request.url, /\/\d+\/cancel$/);
        assert.deepEqual(JSON.parse(request.body), {
          cancellationReason: "User requested cancellation",
        });
        assert.equal((await cancel(owner, pending, key)).status, "CANCELLED");
        assert.equal((await cancel(owner, pending)).status, "CANCELLED");
        assert.equal(f.requests.length, before + 1);
        const events = await f.db.userEventDelivery.findMany({
          where: { userId: owner.user.id, type: "payment.updated" },
        });
        assert.equal(
          events.filter((event) => event.payload.status === "CANCELLED").length,
          1,
        );
        assert.equal(
          await f.db.creditTransaction.count({
            where: { userId: owner.user.id },
          }),
          0,
        );
        assert.equal(
          (await f.reads.creationPolicy(owner.principal)).canCreate,
          true,
        );
        const next = await f.order(owner);
        assert.notEqual(next.id, pending.id);
        await assert.rejects(cancel(owner, next, key), /different command/);
      },
    );
    await t.test(
      "PAID and REVIEW are not cancellable and no provider call is made",
      async () => {
        for (const status of ["PAID", "REVIEW", "FAILED", "REFUNDED"]) {
          const owner = await f.account(),
            pending = await f.order(owner);
          await f.db.payment.update({
            where: { id: pending.id },
            data: { status },
          });
          const before = f.requests.length;
          await assert.rejects(
            cancel(owner, pending),
            /PAYMENT_ALREADY_PAID|PAYMENT_REVIEW_REQUIRED|PAYMENT_CANNOT_CANCEL/,
          );
          assert.equal(f.requests.length, before);
        }
      },
    );
    await t.test(
      "already expired orders return their closed status without provider I/O",
      async () => {
        const owner = await f.account(),
          pending = await f.order(owner);
        await f.db.payment.update({
          where: { id: pending.id },
          data: { status: "EXPIRED" },
        });
        const before = f.requests.length,
          key = randomUUID();
        assert.equal((await cancel(owner, pending, key)).status, "EXPIRED");
        assert.equal((await cancel(owner, pending, key)).status, "EXPIRED");
        assert.equal(f.requests.length, before);
      },
    );
    await t.test(
      "pause still permits cancellation, disabled/wrong-channel/missing-checkout cannot cancel",
      async () => {
        const owner = await f.account(),
          pending = await f.order(owner);
        const saved = f.transport.config;
        const before = f.requests.length;
        try {
          f.transport.config = { enabled: false };
          await assert.rejects(
            cancel(owner, pending),
            /PAYMENT_PROVIDER_UNAVAILABLE/,
          );
          f.transport.config = {
            ...saved,
            PAYOS_CLIENT_ID: "replacement-channel",
          };
          await assert.rejects(
            cancel(owner, pending),
            /PAYMENT_CHANNEL_UNAVAILABLE/,
          );
          assert.equal(f.requests.length, before);
          f.transport.config = { ...saved, creationPaused: true };
          assert.equal((await cancel(owner, pending)).status, "CANCELLED");
        } finally {
          f.transport.config = saved;
        }
        const another = await f.order(owner);
        await f.db.payosCheckout.delete({ where: { paymentId: another.id } });
        await assert.rejects(
          cancel(owner, another),
          /PAYMENT_RECONCILIATION_REQUIRED/,
        );
      },
    );
    await t.test(
      "active create/recovery lease blocks cancel; concurrent cancels cannot duplicate events",
      async () => {
        const owner = await f.account(),
          pending = await f.order(owner);
        await f.db.payosCheckout.update({
          where: { paymentId: pending.id },
          data: {
            leaseToken: randomUUID(),
            leaseUntil: new Date(Date.now() + 30000),
          },
        });
        const before = f.requests.length;
        await assert.rejects(cancel(owner, pending), /PAYMENT_CHECKOUT_BUSY/);
        assert.equal(f.requests.length, before);
        await f.due(pending.id);
        const results = await Promise.allSettled([
          cancel(owner, pending),
          cancel(owner, pending),
        ]);
        assert.ok(results.some((result) => result.status === "fulfilled"));
        assert.equal(
          (await f.reads.detail(owner.principal, pending.id)).status,
          "CANCELLED",
        );
        const events = await f.db.userEventDelivery.findMany({
          where: { userId: owner.user.id },
        });
        assert.equal(
          events.filter((event) => event.payload.status === "CANCELLED").length,
          1,
        );
      },
    );
    await t.test(
      "a stale lease holder cannot confirm cancellation; lookup can recover the provider result",
      async () => {
        const owner = await f.account(),
          pending = await f.order(owner);
        f.beforeCancel = async () => {
          await f.db.payosCheckout.update({
            where: { paymentId: pending.id },
            data: { leaseToken: randomUUID() },
          });
        };
        try {
          await assert.rejects(
            cancel(owner, pending),
            /PAYMENT_CANCELLATION_UNCONFIRMED/,
          );
        } finally {
          f.beforeCancel = undefined;
        }
        assert.equal(
          (await f.reads.detail(owner.principal, pending.id)).status,
          "PENDING",
        );
        await f.due(pending.id);
        await f.worker.process(pending.id);
        assert.equal(
          (await f.reads.detail(owner.principal, pending.id)).status,
          "CANCELLED",
        );
      },
    );
    await t.test(
      "ambiguous CREATED order can be cancelled by immutable orderCode without creating another order",
      async () => {
        const owner = await f.account();
        f.failCreate = 1;
        const pending = await f.order(owner);
        assert.equal(pending.status, "CREATED");
        assert.equal(pending.checkout, null);
        const count = f.providerOrders.size;
        assert.equal((await cancel(owner, pending)).status, "CANCELLED");
        assert.equal(f.providerOrders.size, count);
      },
    );
    await t.test(
      "timeout after provider cancellation never confirms success; lookup recovery preserves CANCELLED",
      async () => {
        const owner = await f.account(),
          pending = await f.order(owner);
        const key = randomUUID();
        f.failCancel = 1;
        await assert.rejects(
          cancel(owner, pending, key),
          /PAYMENT_CANCELLATION_UNCONFIRMED/,
        );
        assert.equal(
          (await f.reads.detail(owner.principal, pending.id)).status,
          "PENDING",
        );
        assert.equal(
          (await f.reads.creationPolicy(owner.principal)).canCreate,
          false,
        );
        await f.due(pending.id);
        await f.worker.process(pending.id);
        assert.equal((await cancel(owner, pending, key)).status, "CANCELLED");
      },
    );
    await t.test(
      "webhook racing with cancel cannot downgrade PAID or post twice",
      async () => {
        const owner = await f.account(),
          pending = await f.order(owner);
        const payload = await f.webhook(pending);
        f.beforeCancel = async () => {
          await f.receipts.webhook(payload);
        };
        try {
          await assert.rejects(cancel(owner, pending), /PAYMENT_ALREADY_PAID/);
        } finally {
          f.beforeCancel = undefined;
        }
        await f.receipts.webhook(payload);
        assert.equal(
          (await f.reads.detail(owner.principal, pending.id)).status,
          "PAID",
        );
        assert.equal(
          await f.db.creditTransaction.count({
            where: { userId: owner.user.id },
          }),
          1,
        );
      },
    );
    await t.test(
      "provider PAID evidence reconciles once; partial/missing evidence requires review",
      async () => {
        for (const kind of ["exact", "partial", "missing"]) {
          const owner = await f.account(),
            pending = await f.order(owner);
          const provider = await providerFor(pending);
          Object.assign(provider, {
            status: kind === "partial" ? "CANCELLED" : "PAID",
            amountPaid: kind === "partial" ? 1000 : provider.amount,
            amountRemaining: kind === "partial" ? provider.amount - 1000 : 0,
            transactions:
              kind === "missing"
                ? []
                : [
                    {
                      reference: randomUUID(),
                      amount: kind === "partial" ? 1000 : provider.amount,
                      transactionDateTime: new Date().toISOString(),
                    },
                  ],
          });
          await assert.rejects(
            cancel(owner, pending),
            /PAYMENT_ALREADY_PAID|PAYMENT_REVIEW_REQUIRED/,
          );
          assert.equal(
            (await f.reads.detail(owner.principal, pending.id)).status,
            kind === "exact" ? "PAID" : "REVIEW",
          );
          assert.equal(
            await f.db.creditTransaction.count({
              where: { userId: owner.user.id },
            }),
            kind === "exact" ? 1 : 0,
          );
        }
      },
    );
    await t.test(
      "a later bank receipt after confirmed cancellation enters REVIEW without credit",
      async () => {
        const owner = await f.account(),
          pending = await f.order(owner);
        await cancel(owner, pending);
        await f.receipts.webhook(await f.webhook(pending));
        assert.equal(
          (await f.reads.detail(owner.principal, pending.id)).status,
          "REVIEW",
        );
        assert.equal(
          await f.db.creditTransaction.count({
            where: { userId: owner.user.id },
          }),
          0,
        );
        assert.equal(
          (
            await f.db.paymentReceipt.findFirstOrThrow({
              where: { paymentId: pending.id },
            })
          ).reason,
          "PAYMENT_CANCELLED",
        );
      },
    );
    await t.test(
      "event failure rolls back local cancellation; retry recovers the provider's closed order",
      async () => {
        const owner = await f.account(),
          pending = await f.order(owner);
        const append = f.events.append;
        f.events.append = async () => {
          throw new Error("injected-event-failure");
        };
        try {
          await assert.rejects(cancel(owner, pending));
        } finally {
          f.events.append = append;
        }
        assert.equal(
          (await f.reads.detail(owner.principal, pending.id)).status,
          "PENDING",
        );
        assert.equal((await checkoutFor(pending)).state, "READY");
        assert.equal((await cancel(owner, pending)).status, "CANCELLED");
      },
    );
  } finally {
    await f.dispose();
  }
});
