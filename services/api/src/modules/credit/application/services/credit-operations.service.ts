import { ConflictException, Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { fingerprintCommand } from "../../../../infrastructure/idempotency/idempotency.service";
import { CreditProvenanceService } from "./credit-provenance.service";

@Injectable()
export class CreditOperationsService {
  constructor(private readonly provenance: CreditProvenanceService) {}

  async lockWallet(tx: TransactionContext, userId: string) {
    await tx.creditWallet.upsert({
      where: { userId },
      create: {
        userId,
        availableCredit: 0n,
        heldCredit: 0n,
        purchasedCredit: 0n,
        bonusCredit: 0n,
        walletVersion: 0,
      },
      update: {},
    });
    await tx.$queryRaw`SELECT user_id FROM credit_wallets WHERE user_id=${userId}::uuid FOR UPDATE`;
    const wallet = await tx.creditWallet.findUniqueOrThrow({
      where: { userId },
    });
    await this.provenance.requireTracked(tx, wallet);
    return wallet;
  }

  async topUp(
    tx: TransactionContext,
    input: {
      userId: string;
      paymentId: string;
      amount: bigint;
      receiptDigest: string;
    },
  ) {
    if (input.amount <= 0n)
      throw new ConflictException("INVALID_CREDIT_ISSUANCE");
    const wallet = await this.lockWallet(tx, input.userId);
    const key = `payment-top-up:${input.paymentId}`;
    const digest = fingerprintCommand({
      ...input,
      amount: input.amount.toString(),
    });
    const existing = await tx.creditOperation.findUnique({
      where: { idempotencyKey: key },
    });
    if (existing) {
      if (existing.instructionDigest !== digest)
        throw new ConflictException("CREDIT_OPERATION_CONFLICT");
      return {
        operationId: existing.id,
        before: wallet.availableCredit,
        after: wallet.availableCredit,
        replayed: true,
      };
    }
    const operation = await tx.creditOperation.create({
      data: {
        operationType: "TOP_UP",
        referenceType: "PAYMENT",
        referenceId: input.paymentId,
        idempotencyKey: key,
        instructionDigest: digest,
        status: "SUCCESS",
      },
    });
    const after = wallet.availableCredit + input.amount;
    await tx.creditWallet.update({
      where: { userId: input.userId },
      data: {
        availableCredit: after,
        purchasedCredit: { increment: input.amount },
        walletVersion: { increment: 1 },
      },
    });
    await tx.creditLot.create({
      data: {
        userId: input.userId,
        operationId: operation.id,
        source: "PURCHASED",
        available: input.amount,
        granted: input.amount,
      },
    });
    await tx.creditTransaction.create({
      data: {
        userId: input.userId,
        operationId: operation.id,
        entryNo: 1,
        type: "TOP_UP",
        amount: input.amount,
        availableDelta: input.amount,
        heldDelta: 0n,
        availableAfter: after,
        heldAfter: wallet.heldCredit,
        status: "SUCCESS",
        idempotencyKey: key,
      },
    });
    return {
      operationId: operation.id,
      before: wallet.availableCredit,
      after,
      replayed: false,
    };
  }
}
