// Spec 021 T030: subscriptions against an isolated, fully migrated PostgreSQL schema.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { MaterialsService } from "../../dist/modules/materials/application/services/materials.service.js";
import { MaterialThumbnailsService } from "../../dist/modules/materials/application/services/material-thumbnails.service.js";
import { DAY, buyer, subscriptionFixture } from "./integration-fixture.mjs";

const settled = (results) => ({
  ok: results.filter((r) => r.status === "fulfilled"),
  failed: results.filter((r) => r.status === "rejected"),
});

test("subscriptions on isolated PostgreSQL", async (t) => {
  const f = await subscriptionFixture();
  try {
    await t.test(
      "migrations hold the CHECKs and the one-current index",
      async () => {
        const owner = await f.account();
        const row = {
          userId: owner.user.id,
          planCode: "CREATOR",
          planVersionId: f.creator.id,
          interval: "MONTH",
          status: "ACTIVE",
          termStart: new Date(),
          termEnd: new Date(Date.now() + 30 * DAY),
        };
        const first = await f.db.userSubscription.create({ data: row });
        await assert.rejects(f.db.userSubscription.create({ data: row }));
        await assert.rejects(
          f.db.userSubscription.create({
            data: { ...row, status: "EXPIRED", termEnd: row.termStart },
          }),
        );
        await assert.rejects(
          f.db.subscriptionUsage.create({
            data: {
              subscriptionId: first.id,
              periodStart: row.termStart,
              recordingMinutesAllowed: 10,
              recordingMinutesUsed: -1,
              addonMinutesRemaining: 0,
            },
          }),
        );
        // Every CHECK the subscriptions migration declares exists in the migrated schema.
        const { rows } = await f.client.query(
          `SELECT conname FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
         WHERE n.nspname = $1 AND contype = 'c' AND conname = ANY($2)`,
          [
            f.schema,
            [
              "subscription_usage_minutes_check",
              "session_whiteboards_retention_days_check",
              "session_recordings_retention_days_check",
              "session_recordings_charged_minutes_check",
            ],
          ],
        );
        assert.equal(rows.length, 4);
      },
    );

    await t.test(
      "concurrent purchases charge once and leave one current plan",
      async () => {
        const account = await f.account();
        await f.fund(account, 50_000n);
        const results = await Promise.allSettled([
          f.purchase(account, "concurrent-a"),
          f.purchase(account, "concurrent-b"),
          f.purchase(account, "concurrent-c"),
        ]);
        const { ok, failed } = settled(results);
        assert.equal(ok.length, 1);
        for (const failure of failed)
          assert.match(failure.reason.message, /SUBSCRIPTION_ALREADY_ACTIVE/);
        assert.equal(await f.wallet(account), 50_000n - 9_900n);
        assert.equal(
          await f.db.userSubscription.count({
            where: { userId: account.user.id, status: "ACTIVE" },
          }),
          1,
        );
        const charges = await f.db.subscriptionCharge.findMany({
          where: { userId: account.user.id },
        });
        assert.equal(charges.length, 1);
        const operation = await f.db.creditOperation.findUnique({
          where: { id: charges[0].operationId },
        });
        assert.equal(operation.referenceType, "SUBSCRIPTION_CHARGE");
        assert.equal(operation.referenceId, charges[0].id);
        const ledger = await f.db.creditTransaction.findMany({
          where: { operationId: operation.id },
        });
        assert.ok(ledger.some((row) => row.type === "SUBSCRIPTION_PURCHASE"));
        // Replaying the winning key returns the stored result without a second charge.
        const winner = ["concurrent-a", "concurrent-b", "concurrent-c"][
          results.findIndex((r) => r.status === "fulfilled")
        ];
        await f.purchase(account, winner);
        assert.equal(await f.wallet(account), 50_000n - 9_900n);
      },
    );

    await t.test(
      "a short balance fails before any subscription write",
      async () => {
        const account = await f.account();
        await f.fund(account, 100n);
        await assert.rejects(
          f.purchase(account),
          /INSUFFICIENT_AVAILABLE_CREDIT/,
        );
        assert.equal(
          await f.db.userSubscription.count({
            where: { userId: account.user.id },
          }),
          0,
        );
      },
    );

    await t.test(
      "renewDue claims a due row once across concurrent workers",
      async () => {
        const account = await f.account();
        await f.fund(account, 50_000n);
        await f.purchase(account);
        const current = await f.db.userSubscription.findFirstOrThrow({
          where: { userId: account.user.id },
        });
        const ended = new Date(Date.now() - 60_000);
        await f.db.userSubscription.update({
          where: { id: current.id },
          data: {
            termStart: new Date(+ended - 30 * DAY),
            termEnd: ended,
            nextRenewalAttemptAt: ended,
          },
        });
        const counts = await Promise.all([
          f.renewals.renewDue(),
          f.renewals.renewDue(),
          f.renewals.renewDue(),
        ]);
        assert.equal(counts.reduce((sum, count) => sum + count, 0) >= 1, true);
        const renewed = await f.db.userSubscription.findUniqueOrThrow({
          where: { id: current.id },
        });
        assert.equal(renewed.status, "ACTIVE");
        assert.equal(+renewed.termStart, +ended);
        assert.equal(+renewed.termEnd, +ended + 30 * DAY);
        const renewalCharges = await f.db.subscriptionCharge.count({
          where: { subscriptionId: current.id, kind: "RENEWAL" },
        });
        assert.equal(renewalCharges, 1);
        assert.equal(await f.wallet(account), 50_000n - 2n * 9_900n);
        const events = await f.db.outboxEvent.count({
          where: { aggregateId: current.id, type: "subscription.renewed" },
        });
        assert.equal(events, 1);
        // The next run finds nothing due.
        assert.equal(await f.renewals.renewDue(), 0);
      },
    );

    await t.test(
      "minute charges and add-on purchases interleave without losing updates",
      async () => {
        const account = await f.account();
        await f.fund(account, 50_000n);
        await f.purchase(account, randomUUID(), "PRO");
        const subscription = await f.db.userSubscription.findFirstOrThrow({
          where: { userId: account.user.id },
        });
        const charge = (minutes) =>
          f.transactions.run(async (tx) =>
            f.reader.chargeRecordingMinutes(
              tx,
              subscription.id,
              BigInt(minutes * 60_000),
              new Date(),
            ),
          );
        await Promise.all([
          charge(5),
          charge(7),
          f.service.buyRecordingMinutes(
            buyer(account),
            { packs: 1, expectedPriceCredit: 30 },
            "addon-concurrent",
          ),
          charge(11),
        ]);
        const [usage] = await f.db.subscriptionUsage.findMany({
          where: { subscriptionId: subscription.id },
        });
        assert.equal(usage.recordingMinutesAllowed, 400);
        assert.equal(usage.recordingMinutesUsed, 23);
        assert.equal(usage.addonMinutesRemaining, 60);
        assert.equal(await f.wallet(account), 50_000n - 29_900n - 3_000n);
        const allowance = await f.transactions.run((tx) =>
          f.reader.recordingAllowance(tx, account.user.id, new Date()),
        );
        assert.equal(allowance.remainingMinutes, 400 - 23 + 60);
      },
    );

    await t.test(
      "concurrent attaches near the storage limit: at most one passes",
      async () => {
        const owner = await f.account();
        await f.fund(owner, 50_000n);
        await f.purchase(owner); // CREATOR here allows 3000 bytes.
        const materials = new MaterialsService(
          f.transactions,
          f.storage,
          f.attachments,
          new MaterialThumbnailsService(f.objectStorage),
          undefined,
          undefined,
          f.reader,
        );
        const upload = async (sizeBytes) => {
          const file = await f.readyFile(owner, {
            purpose: "MATERIAL",
            originalName: "notes.pdf",
            sizeBytes,
          });
          f.objects.set(file.objectKey, Buffer.alloc(16));
          return file;
        };
        const files = [
          await upload(2000),
          await upload(2000),
          await upload(2000),
        ];
        const results = await Promise.allSettled(
          files.map((file) =>
            materials.create(
              owner.principal,
              f.draftInput({ fileId: file.id }),
            ),
          ),
        );
        const { ok, failed } = settled(results);
        assert.equal(ok.length, 1);
        for (const failure of failed)
          assert.match(
            failure.reason.message,
            /MATERIAL_STORAGE_QUOTA_EXCEEDED/,
          );
        assert.equal(
          await f.db.material.count({ where: { ownerId: owner.user.id } }),
          1,
        );
        const me = await f.service.me(buyer(owner));
        assert.deepEqual(me.materialStorage, {
          usedBytes: "2000",
          allowedBytes: "3000",
          enforced: true,
        });
      },
    );
  } finally {
    await f.dispose();
  }
});
