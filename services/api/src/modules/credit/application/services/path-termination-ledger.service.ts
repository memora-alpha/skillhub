import { ConflictException, Injectable } from "@nestjs/common";
import type {
  CreditWallet,
  CreditTransactionType,
  HeldCreditAllocation,
} from "../../../../generated/prisma/client";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  byCodeUnit,
  fingerprintCommand,
} from "../../../../infrastructure/idempotency/idempotency.service";
import {
  PathTerminationPort,
  type HeldTerminationAllocation,
  type PathTerminationInstruction,
  type TerminationQuoteContext,
} from "../ports/path-termination.port";
import { readTerminationQuote } from "./termination-quote.reader";
import { parseCredit } from "../../domain/money";
import { CreditOperationsService } from "./credit-operations.service";
import { CreditProvenanceService } from "./credit-provenance.service";

@Injectable()
export class PathTerminationLedgerService extends PathTerminationPort {
  previewHeld(tx: TransactionContext, input: TerminationQuoteContext) {
    return readTerminationQuote(tx, input);
  }
  constructor(
    private readonly operations: CreditOperationsService,
    private readonly provenance: CreditProvenanceService,
  ) {
    super();
  }

  async distributeHeld(
    tx: TransactionContext,
    input: PathTerminationInstruction,
  ) {
    const key = `path-termination:${input.pathId}:v${input.pathVersion}`;
    const allocations = [...input.allocations].sort((a, b) =>
      byCodeUnit(a.allocationId, b.allocationId),
    );
    const digest = fingerprintCommand({
      pathId: input.pathId,
      pathVersion: input.pathVersion,
      requestId: input.requestId,
      policyReference: input.policyReference,
      participantAId: input.participantAId,
      participantBId: input.participantBId,
      exchangeType: input.exchangeType,
      expectedCredit: String(input.expectedCredit),
      teacherId: input.teacherId,
      learnerId: input.learnerId,
      allocations: allocations.map((item) => ({
        allocationId: item.allocationId,
        refund: String(item.refund),
        counterpartyPayment: String(item.counterpartyPayment),
        platformFee: String(item.platformFee),
      })),
    });
    const existing = await tx.creditOperation.findUnique({
      where: { idempotencyKey: key },
    });
    if (existing) {
      if (existing.instructionDigest !== digest)
        throw new ConflictException("CREDIT_OPERATION_CONFLICT");
      return { operationId: existing.id };
    }
    const held = await tx.heldCreditAllocation.findMany({
      where: {
        pathId: input.pathId,
        lockedPathVersion: input.pathVersion,
        status: "ACTIVE",
        remainingHeld: { gt: 0n },
      },
      orderBy: { id: "asc" },
    });
    this.validateAllocations(input, allocations, held);
    const quote = await this.previewHeld(tx, input);
    if (quote.status !== "READY")
      throw new ConflictException(quote.reasonCodes[0]);
    for (const decision of allocations) {
      const calculated = quote.allocations.find(
        (row) => row.allocationId === decision.allocationId,
      )!;
      const fee = parseCredit(calculated.platformFee);
      let refund = parseCredit(calculated.refund);
      if (input.exchangeType === "TWO_WAY")
        refund -= decision.counterpartyPayment;
      if (
        decision.platformFee !== fee ||
        decision.refund !== refund ||
        (input.exchangeType === "ONE_WAY" &&
          decision.counterpartyPayment !==
            parseCredit(calculated.counterpartyPayment))
      )
        throw new ConflictException("TERMINATION_FORMULA_MISMATCH");
    }
    const wallets = new Map<string, CreditWallet>();
    // Credit owner takes sorted wallets only after the caller's Path/Session locks.
    for (const userId of [input.participantAId, input.participantBId].sort(
      byCodeUnit,
    ))
      wallets.set(userId, await this.operations.lockWallet(tx, userId));
    for (const item of held) {
      const wallet = wallets.get(item.userId);
      if (!wallet || wallet.heldCredit < item.remainingHeld)
        throw new ConflictException("PATH_HOLD_BALANCE_MISMATCH");
    }
    const operation = await tx.creditOperation.create({
      data: {
        operationType: "PATH_TERMINATION",
        referenceType: "LEARNING_PATH",
        referenceId: input.pathId,
        idempotencyKey: key,
        instructionDigest: digest,
        status: "SUCCESS",
      },
    });
    let entryNo = 0;
    const entry = async (
      wallet: CreditWallet,
      type: CreditTransactionType,
      amount: bigint,
      availableDelta: bigint,
      heldDelta: bigint,
    ) => {
      if (amount === 0n) return;
      wallet.availableCredit += availableDelta;
      wallet.heldCredit += heldDelta;
      await tx.creditTransaction.create({
        data: {
          operationId: operation.id,
          entryNo: ++entryNo,
          userId: wallet.userId,
          type,
          amount,
          availableDelta,
          heldDelta,
          availableAfter: wallet.availableCredit,
          heldAfter: wallet.heldCredit,
          status: "SUCCESS",
          idempotencyKey: `${key}:entry:${entryNo}`,
        },
      });
    };
    // Each allocation consumes/releases its original lots; no Available-funded penalty is inferred.
    for (const item of held) {
      const decided = allocations.find((row) => row.allocationId === item.id)!;
      const owner = wallets.get(item.userId)!;
      const recipientId =
        item.userId === input.participantAId
          ? input.participantBId
          : input.participantAId;
      const recipient = wallets.get(recipientId)!;
      await this.provenance.settle(
        tx,
        item.userId,
        item.id,
        decided.counterpartyPayment + decided.platformFee,
        item.remainingHeld,
      );
      await entry(
        owner,
        "RELEASE",
        decided.refund,
        decided.refund,
        -decided.refund,
      );
      await entry(
        owner,
        "ADJUSTMENT",
        decided.counterpartyPayment,
        0n,
        -decided.counterpartyPayment,
      );
      await entry(
        owner,
        "PLATFORM_FEE",
        decided.platformFee,
        0n,
        -decided.platformFee,
      );
      if (decided.counterpartyPayment > 0n) {
        await tx.creditLot.create({
          data: {
            userId: recipientId,
            operationId: operation.id,
            source: "EARNED",
            granted: decided.counterpartyPayment,
            available: decided.counterpartyPayment,
          },
        });
        await entry(
          recipient,
          "ADJUSTMENT",
          decided.counterpartyPayment,
          decided.counterpartyPayment,
          0n,
        );
      }
      await tx.heldCreditAllocation.update({
        where: { id: item.id },
        data: { remainingHeld: 0n, status: "RELEASED", settledAt: input.now },
      });
    }
    for (const wallet of wallets.values())
      await tx.creditWallet.update({
        where: { userId: wallet.userId },
        data: {
          availableCredit: wallet.availableCredit,
          heldCredit: wallet.heldCredit,
          walletVersion: { increment: 1 },
        },
      });
    return { operationId: operation.id };
  }

  private validateAllocations(
    input: PathTerminationInstruction,
    decisions: HeldTerminationAllocation[],
    held: HeldCreditAllocation[],
  ) {
    const count = input.exchangeType === "TWO_WAY" ? 2 : 1;
    const parties = new Set([input.participantAId, input.participantBId]);
    if (
      parties.size !== 2 ||
      !input.policyReference.trim() ||
      held.length !== count ||
      decisions.length !== count ||
      new Set(decisions.map((item) => item.allocationId)).size !== count ||
      new Set(held.map((item) => item.userId)).size !== count
    )
      throw new ConflictException("TERMINATION_ALLOCATION_MISMATCH");
    for (const item of held) {
      const decision = decisions.find((row) => row.allocationId === item.id);
      if (
        !decision ||
        !parties.has(item.userId) ||
        item.remainingHeld !== item.amount ||
        item.amount !== input.expectedCredit ||
        input.expectedCredit <= 0n ||
        decision.refund < 0n ||
        decision.counterpartyPayment < 0n ||
        decision.platformFee < 0n ||
        decision.refund +
          decision.counterpartyPayment +
          decision.platformFee !==
          item.remainingHeld
      )
        throw new ConflictException("TERMINATION_ALLOCATION_MISMATCH");
      if (
        input.exchangeType === "ONE_WAY" &&
        (item.userId !== input.learnerId ||
          item.beneficiaryId !== input.teacherId ||
          item.purpose !== "TEACHING_PAYMENT")
      )
        throw new ConflictException("TERMINATION_ALLOCATION_MISMATCH");
      if (
        input.exchangeType === "TWO_WAY" &&
        (item.purpose !== "COMMITMENT" || item.beneficiaryId !== null)
      )
        throw new ConflictException("TERMINATION_ALLOCATION_MISMATCH");
    }
  }
}
