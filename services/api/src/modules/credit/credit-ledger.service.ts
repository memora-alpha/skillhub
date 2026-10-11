import { ConflictException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { TransactionContext } from "../../infrastructure/database/transaction-context";

export type PathHoldInput = {
  pathId: string;
  pathVersion: number;
  exchangeType: "TWO_WAY" | "ONE_WAY";
  participantAId: string;
  participantBId: string;
  teacherId: string | null;
  learnerId: string | null;
  totalCreditPerUser: bigint | null;
  negotiatedCredit: bigint | null;
};

@Injectable()
export class CreditLedgerService {
  async holdPath(
    tx: TransactionContext,
    input: PathHoldInput,
  ): Promise<string> {
    const operationKey = `path-hold:${input.pathId}:v${input.pathVersion}`;
    const existing = await tx.creditOperation.findUnique({
      where: { idempotencyKey: operationKey },
      select: { id: true },
    });
    if (existing) return existing.id;

    const allocation =
      input.exchangeType === "TWO_WAY"
        ? [
            {
              userId: input.participantAId,
              amount: input.totalCreditPerUser!,
              beneficiaryId: null,
              purpose: "COMMITMENT" as const,
            },
            {
              userId: input.participantBId,
              amount: input.totalCreditPerUser!,
              beneficiaryId: null,
              purpose: "COMMITMENT" as const,
            },
          ]
        : [
            {
              userId: input.learnerId!,
              amount: input.negotiatedCredit!,
              beneficiaryId: input.teacherId,
              purpose: "TEACHING_PAYMENT" as const,
            },
          ];
    const userIds = allocation.map(({ userId }) => userId).sort();
    for (const userId of userIds) {
      await tx.$queryRaw`
        SELECT user_id FROM credit_wallets
        WHERE user_id = ${userId}::uuid FOR UPDATE
      `;
    }
    const wallets = await tx.creditWallet.findMany({
      where: { userId: { in: userIds } },
      orderBy: { userId: "asc" },
    });
    const byUser = new Map(wallets.map((wallet) => [wallet.userId, wallet]));
    if (
      allocation.some(
        ({ userId, amount }) =>
          amount <= 0n || (byUser.get(userId)?.availableCredit ?? -1n) < amount,
      )
    ) {
      throw new ConflictException("INSUFFICIENT_AVAILABLE_CREDIT");
    }
    const operation = await tx.creditOperation.create({
      data: {
        operationType: "PATH_HOLD",
        referenceType: "LEARNING_PATH",
        referenceId: input.pathId,
        idempotencyKey: operationKey,
        status: "SUCCESS",
      },
      select: { id: true },
    });
    for (const [index, item] of allocation.entries()) {
      const wallet = byUser.get(item.userId)!;
      const availableAfter = wallet.availableCredit - item.amount;
      const heldAfter = wallet.heldCredit + item.amount;
      await tx.creditWallet.update({
        where: { userId: item.userId },
        data: {
          availableCredit: availableAfter,
          heldCredit: heldAfter,
          walletVersion: { increment: 1 },
        },
      });
      await tx.creditTransaction.create({
        data: {
          userId: item.userId,
          operationId: operation.id,
          entryNo: index + 1,
          type: "HOLD",
          amount: item.amount,
          availableDelta: -item.amount,
          heldDelta: item.amount,
          availableAfter,
          heldAfter,
          status: "SUCCESS",
          idempotencyKey: `${operationKey}:${item.userId}`,
        },
      });
      await tx.heldCreditAllocation.create({
        data: {
          userId: item.userId,
          pathId: input.pathId,
          lockedPathVersion: input.pathVersion,
          beneficiaryId: item.beneficiaryId,
          purpose: item.purpose,
          amount: item.amount,
          remainingHeld: item.amount,
          status: "ACTIVE",
        },
      });
    }
    return operation.id;
  }

  async settlePath(
    tx: TransactionContext,
    input: {
      pathId: string;
      pathVersion: number;
      exchangeType: "TWO_WAY" | "ONE_WAY";
      now: Date;
    },
  ): Promise<{ operationId: string; gross: bigint; fee: bigint }> {
    const path = await tx.learningPath.findUniqueOrThrow({
      where: { id: input.pathId },
    });
    if (path.settlementOperationId) {
      return {
        operationId: path.settlementOperationId,
        gross: path.settlementGrossAmount ?? 0n,
        fee: path.settlementFeeAmount ?? 0n,
      };
    }
    const agreement = await tx.learningPathVersion.findUniqueOrThrow({
      where: {
        pathId_versionNo: {
          pathId: input.pathId,
          versionNo: input.pathVersion,
        },
      },
    });
    if (!agreement.feePolicyId)
      throw new ConflictException("APPROVED_FEE_POLICY_REQUIRED");
    const policy = await tx.feePolicyVersion.findUnique({
      where: { id: agreement.feePolicyId },
    });
    if (!policy) throw new ConflictException("APPROVED_FEE_POLICY_REQUIRED");
    const calculation = policy.calculationRule as {
      returnedBps?: unknown;
      feeBps?: unknown;
    };
    const rounding = policy.roundingRule as {
      mode?: unknown;
      precision?: unknown;
    };
    if (
      policy.policyCode !== input.exchangeType ||
      policy.status !== "APPROVED" ||
      !policy.approvedAt ||
      !policy.effectiveAt ||
      policy.effectiveAt > input.now ||
      calculation.returnedBps !== 9600 ||
      calculation.feeBps !== 400 ||
      rounding.mode !== "DOWN" ||
      rounding.precision !== 2 ||
      agreement.feeRateSnapshot?.toString() !== "0.04"
    ) {
      throw new ConflictException("UNSUPPORTED_FEE_POLICY");
    }
    const allocations = await tx.heldCreditAllocation.findMany({
      where: {
        pathId: input.pathId,
        lockedPathVersion: input.pathVersion,
        status: "ACTIVE",
        remainingHeld: { gt: 0n },
      },
      orderBy: { userId: "asc" },
    });
    if (allocations.length !== (input.exchangeType === "TWO_WAY" ? 2 : 1)) {
      throw new ConflictException("PATH_HOLD_ALLOCATION_MISSING");
    }
    const roundFee = (gross: bigint) =>
      (gross * BigInt(calculation.feeBps as number)) / 10_000n;
    const operationKey = `path-settlement:${input.pathId}:v${input.pathVersion}`;
    const existing = await tx.creditOperation.findUnique({
      where: { idempotencyKey: operationKey },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException("PATH_SETTLEMENT_REQUIRES_PATH_SNAPSHOT");
    const userIds = [
      ...new Set(
        allocations.flatMap(({ userId, beneficiaryId }) => [
          userId,
          ...(input.exchangeType === "ONE_WAY" && beneficiaryId
            ? [beneficiaryId]
            : []),
        ]),
      ),
    ].sort();
    for (const userId of userIds) {
      await tx.$queryRaw`SELECT user_id FROM credit_wallets WHERE user_id = ${userId}::uuid FOR UPDATE`;
    }
    const wallets = await tx.creditWallet.findMany({
      where: { userId: { in: userIds } },
    });
    const byUser = new Map(wallets.map((wallet) => [wallet.userId, wallet]));
    if (
      allocations.some(
        (item) =>
          item.remainingHeld !== item.amount ||
          (byUser.get(item.userId)?.heldCredit ?? -1n) < item.amount ||
          (input.exchangeType === "ONE_WAY" &&
            (!item.beneficiaryId ||
              item.beneficiaryId === item.userId ||
              !byUser.has(item.beneficiaryId))),
      )
    ) {
      throw new ConflictException("PATH_HOLD_BALANCE_MISMATCH");
    }
    const results = allocations.map((item) => ({
      item,
      gross: item.remainingHeld,
      fee: roundFee(item.remainingHeld),
      returned: item.remainingHeld - roundFee(item.remainingHeld),
    }));
    const operation = await tx.creditOperation.create({
      data: {
        operationType: "PATH_SETTLEMENT",
        referenceType: "LEARNING_PATH",
        referenceId: input.pathId,
        idempotencyKey: operationKey,
        status: "SUCCESS",
      },
      select: { id: true },
    });
    let entryNo = 0;
    let grossTotal = 0n;
    let feeTotal = 0n;
    for (const result of results) {
      const wallet = byUser.get(result.item.userId)!;
      const oneWay = input.exchangeType === "ONE_WAY";
      const availableAfter = oneWay
        ? wallet.availableCredit
        : wallet.availableCredit + result.returned;
      const heldAfter = wallet.heldCredit - result.gross;
      await tx.creditWallet.update({
        where: { userId: result.item.userId },
        data: {
          availableCredit: availableAfter,
          heldCredit: heldAfter,
          walletVersion: { increment: 1 },
        },
      });
      if (oneWay) {
        const teacherWallet = byUser.get(result.item.beneficiaryId!)!;
        const teacherAvailableAfter =
          teacherWallet.availableCredit + result.returned;
        await tx.creditWallet.update({
          where: { userId: teacherWallet.userId },
          data: {
            availableCredit: teacherAvailableAfter,
            walletVersion: { increment: 1 },
          },
        });
        await tx.creditTransaction.create({
          data: {
            userId: result.item.userId,
            operationId: operation.id,
            entryNo: ++entryNo,
            type: "TEACHING_PAYMENT",
            amount: result.returned,
            availableDelta: 0n,
            heldDelta: -result.returned,
            availableAfter: wallet.availableCredit,
            heldAfter: wallet.heldCredit - result.returned,
            status: "SUCCESS",
            idempotencyKey: `${operationKey}:${result.item.userId}:payment`,
          },
        });
        await tx.creditTransaction.create({
          data: {
            userId: teacherWallet.userId,
            operationId: operation.id,
            entryNo: ++entryNo,
            type: "TEACHING_EARNING",
            amount: result.returned,
            availableDelta: result.returned,
            heldDelta: 0n,
            availableAfter: teacherAvailableAfter,
            heldAfter: teacherWallet.heldCredit,
            status: "SUCCESS",
            idempotencyKey: `${operationKey}:${teacherWallet.userId}:earning`,
          },
        });
      } else {
        await tx.creditTransaction.create({
          data: {
            userId: result.item.userId,
            operationId: operation.id,
            entryNo: ++entryNo,
            type: "PATH_RETURN",
            amount: result.returned,
            availableDelta: result.returned,
            heldDelta: -result.returned,
            availableAfter,
            heldAfter: wallet.heldCredit - result.returned,
            status: "SUCCESS",
            idempotencyKey: `${operationKey}:${result.item.userId}:return`,
          },
        });
      }
      if (result.fee > 0n) {
        await tx.creditTransaction.create({
          data: {
            userId: result.item.userId,
            operationId: operation.id,
            entryNo: ++entryNo,
            type: "PLATFORM_FEE",
            amount: result.fee,
            availableDelta: 0n,
            heldDelta: -result.fee,
            availableAfter,
            heldAfter,
            status: "SUCCESS",
            idempotencyKey: `${operationKey}:${result.item.userId}:fee`,
          },
        });
      }
      await tx.heldCreditAllocation.update({
        where: { id: result.item.id },
        data: { remainingHeld: 0n, status: "SETTLED", settledAt: input.now },
      });
      grossTotal += result.gross;
      feeTotal += result.fee;
    }
    const snapshot = {
      policyCode: policy.policyCode,
      versionNo: policy.versionNo,
      calculationRule: policy.calculationRule,
      roundingRule: policy.roundingRule,
    };
    await tx.learningPath.update({
      where: { id: input.pathId },
      data: {
        status: "COMPLETED",
        completedAt: input.now,
        settledPathVersion: input.pathVersion,
        settlementOperationId: operation.id,
        settlementFeePolicyId: policy.id,
        settlementExchangeType: input.exchangeType,
        settlementGrossAmount: grossTotal,
        settlementFeeAmount: feeTotal,
        settlementFeeSnapshot: snapshot,
        settledAt: input.now,
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "LEARNING_PATH",
        aggregateId: input.pathId,
        version: input.pathVersion,
        type: "learning-path.settled",
        payload: {
          pathId: input.pathId,
          operationId: operation.id,
          gross: grossTotal.toString(),
          fee: feeTotal.toString(),
        },
        dedupeKey: `learning-path-settled:${input.pathId}:v${input.pathVersion}`,
        correlationId: randomUUID(),
      },
    });
    return { operationId: operation.id, gross: grossTotal, fee: feeTotal };
  }
}
