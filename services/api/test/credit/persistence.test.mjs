import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { createCreditFixture } from "./fixture.mjs";

test("Credit migration, initialization, sequence allocation and ledger guards on isolated PostgreSQL", async (t) => {
  const f = await createCreditFixture();
  try {
    const account = await f.account();
    await t.test(
      "concurrent zero initialization never issues credit",
      async () => {
        await Promise.all(
          Array.from({ length: 3 }, () =>
            f.transactions.run((tx) =>
              f.repository.ensure(tx, account.user.id),
            ),
          ),
        );
        assert.equal(
          await f.db.creditWallet.count({ where: { userId: account.user.id } }),
          1,
        );
        assert.equal(await f.db.creditTransaction.count(), 0);
        assert.equal(
          (await f.getWallet.execute(account.principal)).availableCredit,
          "0.00",
        );
      },
    );
    await t.test(
      "concurrent writers get a commit-consistent per-wallet order",
      async () => {
        await Promise.all(
          Array.from({ length: 3 }, () => f.post(account.user.id)),
        );
        const entries = await f.db.creditTransaction.findMany({
          where: { userId: account.user.id },
          orderBy: { entrySequence: "asc" },
        });
        assert.deepEqual(
          entries.map((row) => row.entrySequence),
          [1n, 2n, 3n],
        );
        assert.deepEqual(
          entries.map((row) => row.availableAfter),
          [100n, 200n, 300n],
        );
        const wallet = await f.db.creditWallet.findUniqueOrThrow({
          where: { userId: account.user.id },
        });
        assert.equal(wallet.availableCredit, 300n);
        assert.equal(wallet.lastEntrySequence, 3n);
      },
    );
    await t.test(
      "failure after entry rolls back balance, ledger, operation and sequence",
      async () => {
        const count = await f.db.creditOperation.count();
        await assert.rejects(
          f.post(account.user.id, 50n, true),
          /injected-after-entry/,
        );
        assert.equal(await f.db.creditOperation.count(), count);
        const next = await f.post(account.user.id, 50n);
        assert.equal(next.entrySequence, 4n);
        assert.equal(next.availableAfter, 350n);
      },
    );
    await t.test(
      "database rejects negative balance and mutation/deletion of ledger history",
      async () => {
        await assert.rejects(
          f.db.creditWallet.update({
            where: { userId: account.user.id },
            data: { availableCredit: -1n },
          }),
        );
        const entry = await f.db.creditTransaction.findFirstOrThrow();
        await assert.rejects(
          f.db.creditTransaction.update({
            where: { id: entry.id },
            data: { status: "REVERSED" },
          }),
          /CREDIT_LEDGER_APPEND_ONLY/,
        );
        await assert.rejects(
          f.db.creditTransaction.delete({ where: { id: entry.id } }),
          /CREDIT_LEDGER_APPEND_ONLY/,
        );
      },
    );
    await t.test(
      "migration preflight refuses unexplained opening balances atomically",
      async () => {
        const mismatch = await f.account();
        await f.db.creditWallet.create({
          data: {
            userId: mismatch.user.id,
            availableCredit: 1n,
            heldCredit: 0n,
            purchasedCredit: 0n,
            bonusCredit: 0n,
            walletVersion: 0,
          },
        });
        const migration = await readFile(
          new URL(
            "../../prisma/migrations/20261015000000_credit_wallet_foundation/migration.sql",
            import.meta.url,
          ),
          "utf8",
        );
        await assert.rejects(
          f.client.query(migration),
          /CREDIT_PREFLIGHT_OPENING_BALANCE_REQUIRED/,
        );
        await f.client.query("ROLLBACK");
        assert.equal(
          (
            await f.db.creditWallet.findUniqueOrThrow({
              where: { userId: mismatch.user.id },
            })
          ).availableCredit,
          1n,
        );
      },
    );
  } finally {
    await f.dispose();
  }
});
