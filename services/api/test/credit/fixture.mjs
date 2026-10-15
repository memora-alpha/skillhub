import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createSkillFixture } from "../skills/helpers.mjs";
import { PrismaWalletRepository } from "../../dist/modules/credit/infrastructure/persistence/prisma-wallet.repository.js";
import { GetWalletUseCase } from "../../dist/modules/credit/application/use-cases/get-wallet.use-case.js";

export async function createCreditFixture() {
  // The existing harness creates and drops only a fresh UUID-named PostgreSQL schema.
  const f = await createSkillFixture();
  const repository = new PrismaWalletRepository();
  const getWallet = new GetWalletUseCase(f.transactions, f.actors, repository);
  async function post(userId, amount = 100n, fail = false) {
    return f.transactions.run(async (tx) => {
      await repository.ensure(tx, userId);
      await tx.$queryRaw`SELECT user_id FROM credit_wallets WHERE user_id=${userId}::uuid FOR UPDATE`;
      const before = await tx.creditWallet.findUniqueOrThrow({
        where: { userId },
      });
      const after = await tx.creditWallet.update({
        where: { userId },
        data: {
          availableCredit: before.availableCredit + amount,
          walletVersion: { increment: 1 },
        },
      });
      const operation = await tx.creditOperation.create({
        data: {
          operationType: "TEST_ISSUANCE",
          referenceType: "SYSTEM",
          referenceId: randomUUID(),
          idempotencyKey: randomUUID(),
          status: "SUCCESS",
        },
      });
      const entry = await tx.creditTransaction.create({
        data: {
          userId,
          operationId: operation.id,
          entryNo: 1,
          type: "TOP_UP",
          amount,
          availableDelta: amount,
          heldDelta: 0n,
          availableAfter: after.availableCredit,
          heldAfter: after.heldCredit,
          status: "SUCCESS",
          idempotencyKey: randomUUID(),
        },
      });
      if (fail) throw new Error("injected-after-entry");
      return entry;
    });
  }
  return { ...f, repository, getWallet, post };
}
