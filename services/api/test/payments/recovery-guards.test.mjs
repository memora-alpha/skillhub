import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createPaymentFixture } from "./fixture.mjs";
import { PaymentReconciliationReader } from "../../dist/modules/payments/application/services/payment-reconciliation.reader.js";

const body = { paymentAmountVnd: "100000", gateway: "PAYOS" };
async function removeRecoverySchema(f) {
  // Test-only reconstruction of the pre-migration shape in the disposable schema.
  await f.client
    .query(`DROP TRIGGER payment_creation_identity_immutable ON payments;
    DROP TRIGGER payment_creation_identity_no_truncate ON payments;
    DROP FUNCTION protect_payment_creation_identity();
    DROP INDEX payments_user_id_status_created_at_payment_id_idx;
    ALTER TABLE payments DROP COLUMN creation_key_digest CASCADE, DROP COLUMN creation_fingerprint CASCADE;`);
}
test("payment creation recovery and operational gates on PostgreSQL", async (t) => {
  const f = await createPaymentFixture();
  const forgetHttp = (account) =>
    f.db.idempotencyRecord.deleteMany({
      where: { scope: account.user.id, operation: "payment:create" },
    });
  try {
    await t.test(
      "domain identity repairs missing HTTP mappings for pending and paid orders; changed body remains rejected",
      async () => {
        const account = await f.account(),
          key = randomUUID(),
          command = f.command(account, key);
        const first = await f.create.execute(command, body);
        const before = f.requests.length;
        await forgetHttp(account);
        const replay = await f.create.execute(command, body);
        assert.equal(replay.replayed, true);
        assert.equal(replay.data.id, first.data.id);
        assert.equal(f.requests.length, before);
        await forgetHttp(account);
        await assert.rejects(
          f.create.execute(command, { ...body, paymentAmountVnd: "200000" }),
          /different command/,
        );
        assert.equal(
          await f.db.payment.count({ where: { userId: account.user.id } }),
          1,
        );
        await f.receipts.webhook(await f.webhook(first.data));
        await forgetHttp(account);
        assert.equal(
          (await f.create.execute(command, body)).data.status,
          "PAID",
        );
        assert.equal(
          await f.db.creditTransaction.count({
            where: { userId: account.user.id },
          }),
          1,
        );
        const other = await f.account();
        assert.notEqual(
          (await f.create.execute(f.command(other, key), body)).data.id,
          first.data.id,
        );
      },
    );
    await t.test(
      "parallel fresh keys create one unresolved intent, with rejected attempts fully rolled back",
      async () => {
        const account = await f.account(),
          before = f.requests.length;
        const results = await Promise.allSettled([
          f.order(account),
          f.order(account),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        const rejected = results.find((r) => r.status === "rejected");
        assert.match(rejected.reason.message, /PAYMENT_UNRESOLVED/);
        assert.equal(
          await f.db.payment.count({ where: { userId: account.user.id } }),
          1,
        );
        assert.equal(
          await f.db.idempotencyRecord.count({
            where: { scope: account.user.id, operation: "payment:create" },
          }),
          1,
        );
        assert.equal(f.requests.length, before + 1);
      },
    );
    await t.test(
      "financial REVIEW blocks fresh keys and preserves the original key even after mapping loss",
      async () => {
        const account = await f.account(),
          key = randomUUID();
        const pending = await f.order(account, "100000", key);
        await assert.rejects(f.order(account), /PAYMENT_UNRESOLVED/);
        await f.transactions.run((tx) =>
          f.receipts.review(tx, pending.id, "PAYMENT_AMOUNT_MISMATCH"),
        );
        const reviewed = await f.reads.detail(account.principal, pending.id);
        assert.equal(reviewed.status, "REVIEW");
        assert.equal(reviewed.recoveryRequired, true);
        assert.equal(reviewed.recoveryReason, "PAYMENT_REVIEW_REQUIRED");
        await assert.rejects(f.order(account), /PAYMENT_UNRESOLVED/);
        await forgetHttp(account);
        assert.equal(
          (await f.create.execute(f.command(account, key), body)).data.id,
          pending.id,
        );
        assert.equal(
          (await f.reads.creationPolicy(account.principal)).existingPaymentId,
          pending.id,
        );
        await f.receipts.webhook(await f.webhook(pending));
        assert.equal(
          (await f.reads.detail(account.principal, pending.id)).status,
          "REVIEW",
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
      "creation pause blocks unmapped keys but permits safe replays, recovery and verified webhooks",
      async () => {
        const account = await f.account(),
          newcomer = await f.account(),
          key = randomUUID();
        const pending = await f.order(account, "100000", key),
          saved = f.transport.config;
        f.transport.config = { ...saved, creationPaused: true };
        try {
          assert.equal(
            (await f.reads.creationPolicy(newcomer.principal)).reasonCode,
            "PAYMENT_CREATION_PAUSED",
          );
          const before = f.requests.length;
          await assert.rejects(f.order(newcomer), /PAYMENT_CREATION_PAUSED/);
          assert.equal(f.requests.length, before);
          assert.equal(
            await f.db.idempotencyRecord.count({
              where: { scope: newcomer.user.id },
            }),
            0,
          );
          assert.equal(
            (await f.reads.detail(account.principal, pending.id)).checkout,
            null,
          );
          assert.equal(
            (await f.create.execute(f.command(account, key), body)).replayed,
            true,
          );
          await forgetHttp(account);
          assert.equal(
            (await f.create.execute(f.command(account, key), body)).replayed,
            true,
          );
          await f.due(pending.id);
          await f.worker.recover();
          assert.ok(f.requests.length > before);
          await f.receipts.webhook(await f.webhook(pending));
          assert.equal(
            (await f.reads.detail(account.principal, pending.id)).status,
            "PAID",
          );
        } finally {
          f.transport.config = saved;
        }
      },
    );
    await t.test(
      "changed channel hides old QR and globally blocks fresh creates without leaking another owner's ID",
      async () => {
        const account = await f.account(),
          newcomer = await f.account(),
          key = randomUUID();
        const pending = await f.order(account, "100000", key),
          saved = f.transport.config;
        f.transport.config = {
          ...saved,
          PAYOS_CLIENT_ID: "replacement-channel",
        };
        try {
          const before = f.requests.length;
          const view = await f.reads.detail(account.principal, pending.id);
          assert.equal(view.checkout, null);
          assert.equal(view.recoveryReason, "PAYMENT_CHANNEL_UNAVAILABLE");
          assert.equal(
            (await f.create.execute(f.command(account, key), body)).data
              .checkout,
            null,
          );
          const gate = await f.reads.creationPolicy(newcomer.principal);
          assert.equal(
            gate.reasonCode,
            "PAYMENT_CHANNEL_RECONCILIATION_REQUIRED",
          );
          assert.equal(gate.existingPaymentId, null);
          await assert.rejects(
            f.order(newcomer),
            /PAYMENT_CHANNEL_RECONCILIATION_REQUIRED/,
          );
          await f.due(pending.id);
          await f.worker.recover();
          assert.equal(f.requests.length, before);
        } finally {
          f.transport.config = saved;
        }
      },
    );
    await t.test(
      "retained mapping pointing at a missing payment fails closed instead of making a new intent",
      async () => {
        const account = await f.account(),
          key = randomUUID(),
          id = randomUUID();
        // Simulate a partial restore without deleting an anchored production row.
        await f.db.idempotencyRecord.create({
          data: {
            scope: account.user.id,
            operation: "payment:create",
            keyDigest: createHash("sha256").update(key).digest("hex"),
            fingerprint: createHash("sha256")
              .update('{"gateway":"PAYOS","paymentAmountVnd":"100000"}')
              .digest("hex"),
            resultReference: { id, status: "CREATED" },
            completedAt: new Date(),
          },
        });
        await assert.rejects(
          f.create.execute(f.command(account, key), body),
          /PAYMENT_RECONCILIATION_REQUIRED/,
        );
        assert.equal(
          await f.db.payment.count({ where: { userId: account.user.id } }),
          0,
        );
      },
    );
    await t.test(
      "legacy paid rows without a recoverable creation identity block new keys",
      async () => {
        const account = await f.account();
        const legacy = await f.db.payment.create({
          data: {
            userId: account.user.id,
            gateway: "PAYOS",
            status: "PAID",
            creditAmount: 10000n,
            paymentAmountVnd: 100000n,
            currency: "VND",
          },
        });
        const gate = await f.reads.creationPolicy(account.principal);
        assert.equal(gate.existingPaymentId, legacy.id);
        assert.equal(gate.reasonCode, "PAYMENT_RECONCILIATION_REQUIRED");
        await assert.rejects(
          f.order(account),
          /PAYMENT_RECONCILIATION_REQUIRED/,
        );
      },
    );
    await t.test("payment identity cannot be edited or deleted", async () => {
      const account = await f.account(),
        pending = await f.order(account);
      await assert.rejects(
        f.db.payment.update({
          where: { id: pending.id },
          data: { creationKeyDigest: "a".repeat(64) },
        }),
        /immutable/,
      );
      await assert.rejects(
        f.client.query("TRUNCATE payments CASCADE"),
        /retained/,
      );
      // Remove the dependent checkout in this isolated fixture to exercise the identity trigger itself.
      await f.db.payosCheckout.delete({ where: { paymentId: pending.id } });
      await assert.rejects(
        f.db.payment.delete({ where: { id: pending.id } }),
        /retained/,
      );
      assert.equal(
        (await f.reads.detail(account.principal, pending.id)).recoveryReason,
        "PAYMENT_CHECKOUT_MISSING",
      );
    });
    await t.test(
      "operator reports are bounded read-only snapshots, preserve financial state and never expose QR/secrets",
      async () => {
        const account = await f.account(),
          pending = await f.order(account);
        const reports = new PaymentReconciliationReader(
          f.transactions,
          f.transport,
        );
        const countsBefore = await f.db.payment.count();
        const byOwner = await reports.report(
          { userId: account.user.id, limit: 1 },
          true,
        );
        assert.equal(byOwner.records[0].provider.state, "VERIFIED");
        assert.equal(byOwner.records[0].provider.status, "PENDING");
        assert.doesNotMatch(
          JSON.stringify(byOwner),
          /qrCode|lookupQuote|private-fixture|api-key|checksum|returnUrl|cancelUrl/,
        );
        await forgetHttp(account);
        assert.ok(
          (
            await reports.report({ paymentId: pending.id })
          ).records[0].findings.includes(
            "PAYMENT_HTTP_MAPPING_MISSING_OR_MISMATCHED",
          ),
        );
        const payload = await f.webhook(pending);
        await f.receipts.webhook(payload);
        const byBank = await reports.report({
          transactionId: payload.data.reference,
        });
        assert.equal(byBank.records[0].paymentId, pending.id);
        assert.equal(byBank.records[0].status, "PAID");
        const byOrder = await reports.report({
          orderCode: pending.checkout.orderCode,
        });
        assert.equal(byOrder.records[0].paymentId, pending.id);
        const orphan = await reports.report({ orderCode: "123" }, true);
        assert.equal(orphan.missingPayment, true);
        assert.equal(orphan.records.length, 0);
        assert.equal(await f.db.payment.count(), countsBefore);
        for (const input of [
          {},
          { userId: account.user.id, paymentId: pending.id },
          { orderCode: "1 OR 1=1" },
          { userId: account.user.id, limit: 101 },
        ])
          await assert.rejects(
            reports.report(input),
            /INVALID_PAYMENT_RECONCILIATION_SELECTOR/,
          );
      },
    );
  } finally {
    await f.dispose();
  }
});

test("migration backfills retained mappings without changing payment identity", async () => {
  const f = await createPaymentFixture();
  try {
    const account = await f.account(),
      key = randomUUID(),
      pending = await f.order(account, "100000", key);
    const before = await f.db.payment.findUniqueOrThrow({
      where: { id: pending.id },
    });
    await removeRecoverySchema(f);
    const migration = await readFile(
      new URL(
        "../../prisma/migrations/20261018000000_payment_recovery_guards/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await f.client.query(migration);
    const after = await f.db.payment.findUniqueOrThrow({
      where: { id: pending.id },
    });
    assert.equal(after.creationKeyDigest, before.creationKeyDigest);
    assert.equal(after.creationFingerprint, before.creationFingerprint);
    assert.equal(after.externalOrderRef, before.externalOrderRef);
    await f.db.idempotencyRecord.deleteMany({
      where: { scope: account.user.id, operation: "payment:create" },
    });
    assert.equal(
      (await f.create.execute(f.command(account, key), body)).data.id,
      pending.id,
    );
    const mapping = await f.db.idempotencyRecord.findFirstOrThrow({
      where: { scope: account.user.id, operation: "payment:create" },
    });
    await f.db.idempotencyRecord.create({
      data: {
        scope: mapping.scope,
        operation: mapping.operation,
        keyDigest: "b".repeat(64),
        fingerprint: mapping.fingerprint,
        resultReference: mapping.resultReference,
        completedAt: new Date(),
      },
    });
    await removeRecoverySchema(f);
    await assert.rejects(f.client.query(migration), /requires reconciliation/);
    await f.client.query("ROLLBACK");
    const columns = await f.client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='payments' AND column_name='creation_key_digest'",
    );
    assert.equal(
      columns.rows.length,
      0,
      "ambiguous backfill rolls back additive DDL too",
    );
    const retained = await f.client.query(
      "SELECT payment_id FROM payments WHERE payment_id=$1",
      [pending.id],
    );
    assert.equal(retained.rows[0].payment_id, pending.id);
  } finally {
    await f.dispose();
  }
});
