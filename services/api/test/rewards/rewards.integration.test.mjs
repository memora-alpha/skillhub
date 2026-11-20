import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { createSkillFixture } from "../skills/helpers.mjs";
import { CreditOperationsService } from "../../dist/modules/credit/application/services/credit-operations.service.js";
import { CreditProvenanceService } from "../../dist/modules/credit/application/services/credit-provenance.service.js";
import { seedApprovedConfigurations } from "../../dist/modules/system-configuration/application/seed-configuration.js";
import { ConfigurationRepository } from "../../dist/modules/system-configuration/infrastructure/persistence/configuration.repository.js";
import { SystemConfigurationService } from "../../dist/modules/system-configuration/application/services/system-configuration.service.js";
import { CatalogSyncService } from "../../dist/modules/rewards/application/services/catalog-sync.service.js";
import { RedemptionService } from "../../dist/modules/rewards/application/services/redemption.service.js";
import { VoucherSecretCipher } from "../../dist/modules/rewards/application/services/voucher-secret.cipher.js";
import { MockVoucherProvider } from "../../dist/modules/rewards/infrastructure/providers/mock-voucher.provider.js";

const PRICE = 5000n; // 50.00 Credit
const secretKey = randomBytes(32).toString("base64");
const config = {
  get: (name) =>
    ({
      VOUCHER_REDEMPTION_ENABLED: true,
      VOUCHER_SECRET_KEY: secretKey,
    })[name],
};

test(
  "voucher redemption on isolated PostgreSQL",
  { skip: !process.env.DATABASE_URL, timeout: 180_000 },
  async (t) => {
    process.env.TEST_DATABASE_URL ??= process.env.DATABASE_URL;
    const f = await createSkillFixture();
    try {
      const configRepository = new ConfigurationRepository(f.db);
      await f.transactions.run((tx) =>
        seedApprovedConfigurations(tx, configRepository),
      );
      const credits = new CreditOperationsService(
        new CreditProvenanceService(),
      );
      const provider = new MockVoucherProvider();
      const service = new RedemptionService(
        f.db,
        f.transactions,
        f.commands,
        credits,
        f.audit,
        provider,
        new VoucherSecretCipher(config),
        new SystemConfigurationService(configRepository, {
          now: () => new Date(),
        }),
        config,
      );
      await new CatalogSyncService(f.transactions, provider).sync();
      await f.db.rewardProduct.updateMany({
        data: { priceCredit: PRICE, status: "ACTIVE" },
      });
      const product = (providerProductId) =>
        f.db.rewardProduct.findFirstOrThrow({ where: { providerProductId } });
      const fund = (account, amount = 10_000n) =>
        f.transactions.run((tx) =>
          credits.topUp(tx, {
            userId: account.user.id,
            paymentId: randomUUID(),
            amount,
            receiptDigest: "fixture",
          }),
        );
      const wallet = (account) =>
        f.db.creditWallet.findUniqueOrThrow({
          where: { userId: account.user.id },
        });
      const redeem = async (account, id, key = randomUUID(), version) => {
        const p = await product(id);
        return service.redeem(
          account.principal,
          {
            productId: p.id,
            expectedPriceVersion: version ?? p.priceVersion,
          },
          key,
        );
      };
      const makeDue = () =>
        f.db.voucherRedemption.updateMany({
          where: { status: "ISSUING" },
          data: { nextCheckAt: new Date(0) },
        });

      await t.test(
        "success debits purchased Credit and reveals an audited voucher",
        async () => {
          const user = await f.account();
          await fund(user);
          const result = await redeem(user, "coffee-50k-ok");
          assert.equal(result.status, "ISSUED");
          assert.equal((await wallet(user)).availableCredit, 10_000n - PRICE);
          assert.equal((await wallet(user)).purchasedCredit, 10_000n - PRICE);
          const detail = await service.get(user.principal, result.id);
          assert.match(detail.voucher.code, /^DEMO-/);
          const stored = await f.db.issuedVoucher.findUniqueOrThrow({
            where: { redemptionId: result.id },
          });
          assert.ok(
            !Buffer.from(stored.secretCiphertext).toString().includes("DEMO-"),
          );
          const reveals = await f.db.auditLog.count({
            where: { action: "VOUCHER_REVEAL", targetId: result.id },
          });
          assert.equal(reveals, 1);
        },
      );

      await t.test("bonus Credit cannot pay for a voucher", async () => {
        const user = await f.account();
        await fund(user, 100n);
        const op = await f.db.creditOperation.create({
          data: {
            operationType: "DAILY_BONUS",
            referenceType: "SYSTEM",
            referenceId: randomUUID(),
            idempotencyKey: randomUUID(),
            status: "SUCCESS",
          },
        });
        await f.db.creditLot.create({
          data: {
            userId: user.user.id,
            operationId: op.id,
            source: "BONUS",
            available: 10_000n,
            granted: 10_000n,
          },
        });
        await f.db.creditWallet.update({
          where: { userId: user.user.id },
          data: {
            availableCredit: { increment: 10_000n },
            bonusCredit: { increment: 10_000n },
          },
        });
        await assert.rejects(
          redeem(user, "coffee-50k-ok"),
          /INSUFFICIENT_PURCHASED_CREDIT/,
        );
        assert.equal(
          await f.db.voucherRedemption.count({
            where: { userId: user.user.id },
          }),
          0,
        );
      });

      await t.test(
        "idempotency replays without a second debit and rejects key reuse",
        async () => {
          const user = await f.account();
          await fund(user);
          const key = randomUUID();
          const first = await redeem(user, "coffee-50k-ok", key);
          const again = await redeem(user, "coffee-50k-ok", key);
          assert.equal(again.id, first.id);
          assert.equal((await wallet(user)).availableCredit, 10_000n - PRICE);
          await assert.rejects(
            redeem(user, "coffee-100k-ok", key),
            /IDEMPOTENCY_KEY_REUSED/,
          );
          await assert.rejects(
            service.redeem(
              user.principal,
              { productId: first.product.id, expectedPriceVersion: 1 },
              undefined,
            ),
            /IDEMPOTENCY_KEY_REQUIRED/,
          );
        },
      );

      await t.test(
        "stale price version is rejected without a debit",
        async () => {
          const user = await f.account();
          await fund(user);
          await assert.rejects(
            redeem(user, "coffee-50k-ok", randomUUID(), 999),
            /REWARD_PRICE_CHANGED/,
          );
          assert.equal((await wallet(user)).availableCredit, 10_000n);
        },
      );

      await t.test(
        "definitive provider failure refunds and the ledger nets to zero",
        async () => {
          const user = await f.account();
          await fund(user);
          const result = await redeem(user, "mart-oos");
          assert.equal(result.status, "FAILED_REFUNDED");
          const w = await wallet(user);
          assert.equal(w.availableCredit, 10_000n);
          assert.equal(w.purchasedCredit, 10_000n);
          const entries = await f.db.creditTransaction.findMany({
            where: {
              userId: user.user.id,
              type: { in: ["VOUCHER_REDEMPTION", "REFUND"] },
            },
          });
          assert.equal(
            entries.reduce((sum, row) => sum + row.availableDelta, 0n),
            0n,
          );
          assert.equal(entries.length, 2);
        },
      );

      await t.test(
        "timeout stays ISSUING, then reconciles to ISSUED without refund",
        async () => {
          const user = await f.account();
          await fund(user);
          const result = await redeem(user, "coffee-timeout");
          assert.equal(result.status, "ISSUING");
          assert.equal((await wallet(user)).availableCredit, 10_000n - PRICE);
          await makeDue();
          await service.reconcileDue();
          const row = await f.db.voucherRedemption.findUniqueOrThrow({
            where: { id: result.id },
          });
          assert.equal(row.status, "ISSUED");
          assert.equal(row.refundOperationId, null);
          assert.equal((await wallet(user)).availableCredit, 10_000n - PRICE);
        },
      );

      await t.test(
        "lost result escalates to MANUAL_REVIEW, then staff refund restores Credit",
        async () => {
          const user = await f.account();
          const staff = await f.account("STAFF");
          await fund(user);
          const result = await redeem(user, "books-lost");
          for (let i = 0; i < 6; i += 1) {
            await makeDue();
            await service.reconcileDue();
          }
          const row = await f.db.voucherRedemption.findUniqueOrThrow({
            where: { id: result.id },
          });
          assert.equal(row.status, "MANUAL_REVIEW");
          assert.equal((await wallet(user)).availableCredit, 10_000n - PRICE);
          await assert.rejects(
            service.resolve(user.principal, result.id, {
              action: "REFUND",
              reason: "no permission",
            }),
            /REWARD_PERMISSION_REQUIRED/,
          );
          await assert.rejects(
            service.resolve(staff.principal, result.id, {
              action: "REFUND",
              reason: "  ",
            }),
            /REASON_REQUIRED/,
          );
          const resolved = await service.resolve(staff.principal, result.id, {
            action: "REFUND",
            reason: "Provider has no record",
          });
          assert.equal(resolved.status, "REFUNDED_MANUAL");
          assert.equal((await wallet(user)).availableCredit, 10_000n);
          await assert.rejects(
            service.resolve(staff.principal, result.id, {
              action: "REFUND",
              reason: "again",
            }),
            /VOUCHER_INVALID_TRANSITION/,
          );
          assert.equal(
            await f.db.auditLog.count({
              where: { action: "VOUCHER_RESOLVE", targetId: result.id },
            }),
            1,
          );
        },
      );

      await t.test("concurrent redemptions cannot overspend", async () => {
        const user = await f.account();
        await fund(user, PRICE);
        const outcomes = await Promise.allSettled([
          redeem(user, "coffee-50k-ok"),
          redeem(user, "coffee-50k-ok"),
          redeem(user, "coffee-50k-ok"),
        ]);
        assert.equal(
          outcomes.filter((o) => o.status === "fulfilled").length,
          1,
        );
        assert.equal((await wallet(user)).availableCredit, 0n);
      });

      await t.test("only the owner can read a redemption", async () => {
        const owner = await f.account();
        const other = await f.account();
        await fund(owner);
        const result = await redeem(owner, "coffee-50k-ok");
        await assert.rejects(
          service.get(other.principal, result.id),
          /VOUCHER_REDEMPTION_NOT_FOUND/,
        );
        const page = await service.list(owner.principal, {});
        assert.equal(page.data.length, 1);
        assert.equal((await service.list(other.principal, {})).data.length, 0);
      });

      await t.test(
        "unpriced or inactive products are not redeemable",
        async () => {
          const user = await f.account();
          await fund(user);
          const p = await product("ride-30k-ok");
          await f.db.rewardProduct.update({
            where: { id: p.id },
            data: { status: "INACTIVE" },
          });
          await assert.rejects(
            redeem(user, "ride-30k-ok"),
            /REWARD_NOT_AVAILABLE/,
          );
          assert.equal((await wallet(user)).availableCredit, 10_000n);
        },
      );
    } finally {
      await f.dispose();
    }
  },
);
