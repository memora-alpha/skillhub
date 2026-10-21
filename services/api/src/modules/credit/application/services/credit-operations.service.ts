import { ConflictException, Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  byCodeUnit,
  fingerprintCommand,
} from "../../../../infrastructure/idempotency/idempotency.service";
import type { CreditWallet } from "../../../../generated/prisma/client";
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

  /**
   * BR-43: the buyer pays gross from Available, the seller earns gross − fee.
   * PLATFORM_FEE is the buyer's second debit entry of the same gross, never an extra charge.
   */
  async purchaseMaterial(
    tx: TransactionContext,
    input: {
      orderId: string;
      buyerId: string;
      sellerId: string;
      gross: bigint;
      fee: bigint;
    },
  ): Promise<{ operationId: string }> {
    const net = input.gross - input.fee;
    if (
      input.gross <= 0n ||
      input.fee < 0n ||
      net <= 0n ||
      input.buyerId === input.sellerId
    )
      throw new ConflictException("INVALID_MATERIAL_PAYMENT");
    const wallets = new Map<string, CreditWallet>();
    // UUID lock order prevents deadlocks between concurrent purchases of the same pair.
    for (const userId of [input.buyerId, input.sellerId].sort(byCodeUnit)) {
      wallets.set(userId, await this.lockWallet(tx, userId));
    }
    const buyer = wallets.get(input.buyerId)!;
    const seller = wallets.get(input.sellerId)!;
    if (buyer.availableCredit < input.gross)
      throw new ConflictException("INSUFFICIENT_AVAILABLE_CREDIT");
    const key = `material-purchase:${input.orderId}`;
    const operation = await tx.creditOperation.create({
      data: {
        operationType: "MATERIAL_PURCHASE",
        referenceType: "MATERIAL_ORDER",
        referenceId: input.orderId,
        idempotencyKey: key,
        status: "SUCCESS",
      },
    });
    const spent = await this.provenance.spend(tx, buyer.userId, input.gross);
    const buyerAfter = buyer.availableCredit - input.gross;
    await tx.creditWallet.update({
      where: { userId: buyer.userId },
      data: {
        availableCredit: buyerAfter,
        purchasedCredit: { decrement: spent.purchased },
        bonusCredit: { decrement: spent.bonus },
        walletVersion: { increment: 1 },
      },
    });
    const sellerAfter = seller.availableCredit + net;
    await tx.creditLot.create({
      data: {
        userId: seller.userId,
        operationId: operation.id,
        source: "EARNED",
        available: net,
        granted: net,
      },
    });
    await tx.creditWallet.update({
      where: { userId: seller.userId },
      data: { availableCredit: sellerAfter, walletVersion: { increment: 1 } },
    });
    const entries: {
      userId: string;
      type: "MATERIAL_PURCHASE" | "PLATFORM_FEE" | "MATERIAL_SALE";
      amount: bigint;
      availableDelta: bigint;
      availableAfter: bigint;
      heldAfter: bigint;
      suffix: string;
    }[] = [
      {
        userId: buyer.userId,
        type: "MATERIAL_PURCHASE",
        amount: net,
        availableDelta: -net,
        availableAfter: buyer.availableCredit - net,
        heldAfter: buyer.heldCredit,
        suffix: "purchase",
      },
      ...(input.fee > 0n
        ? [
            {
              userId: buyer.userId,
              type: "PLATFORM_FEE" as const,
              amount: input.fee,
              availableDelta: -input.fee,
              availableAfter: buyerAfter,
              heldAfter: buyer.heldCredit,
              suffix: "fee",
            },
          ]
        : []),
      {
        userId: seller.userId,
        type: "MATERIAL_SALE",
        amount: net,
        availableDelta: net,
        availableAfter: sellerAfter,
        heldAfter: seller.heldCredit,
        suffix: "sale",
      },
    ];
    for (const [index, entry] of entries.entries()) {
      // Sequential inserts keep entry_no aligned with each wallet's running balance.
      await tx.creditTransaction.create({
        data: {
          userId: entry.userId,
          operationId: operation.id,
          entryNo: index + 1,
          type: entry.type,
          amount: entry.amount,
          availableDelta: entry.availableDelta,
          heldDelta: 0n,
          availableAfter: entry.availableAfter,
          heldAfter: entry.heldAfter,
          status: "SUCCESS",
          idempotencyKey: `${key}:${entry.suffix}`,
        },
      });
    }
    return { operationId: operation.id };
  }
}
