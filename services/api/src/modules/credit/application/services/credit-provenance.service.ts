import { ConflictException, Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { CreditWallet } from "../../../../generated/prisma/client";

/** All methods require the caller to hold the wallet lock. Amounts are hundredths of Credit. */
@Injectable()
export class CreditProvenanceService {
  async requireTracked(tx: TransactionContext, wallet: CreditWallet) {
    if (!wallet.provenanceTracked) {
      if (
        wallet.availableCredit ||
        wallet.heldCredit ||
        wallet.purchasedCredit ||
        wallet.bonusCredit
      )
        throw new ConflictException("CREDIT_PROVENANCE_REVIEW_REQUIRED");
      await tx.creditWallet.update({
        where: { userId: wallet.userId },
        data: { provenanceTracked: true },
      });
      wallet.provenanceTracked = true;
    }
    const lots = await tx.creditLot.findMany({
      where: { userId: wallet.userId },
    });
    const total = lots.reduce(
      (sum, lot) => ({
        available: sum.available + lot.available,
        held: sum.held + lot.held,
        purchased:
          sum.purchased +
          (lot.source === "PURCHASED" ? lot.available + lot.held : 0n),
        bonus:
          sum.bonus + (lot.source === "BONUS" ? lot.available + lot.held : 0n),
      }),
      { available: 0n, held: 0n, purchased: 0n, bonus: 0n },
    );
    if (
      total.available !== wallet.availableCredit ||
      total.held !== wallet.heldCredit ||
      total.purchased !== wallet.purchasedCredit ||
      total.bonus !== wallet.bonusCredit
    )
      throw new ConflictException("CREDIT_PROVENANCE_BALANCE_MISMATCH");
  }

  async hold(
    tx: TransactionContext,
    userId: string,
    allocationId: string,
    amount: bigint,
  ) {
    const lots = await tx.creditLot.findMany({
      where: { userId, available: { gt: 0n } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    // Stable partition preserves FIFO within BONUS and all other sources.
    const ordered = [
      ...lots.filter((lot) => lot.source === "BONUS"),
      ...lots.filter((lot) => lot.source !== "BONUS"),
    ];
    let remaining = amount;
    for (const lot of ordered) {
      if (remaining === 0n) break;
      const used = lot.available < remaining ? lot.available : remaining;
      // Each write depends on the preceding allocation to preserve deterministic consumption.
      await tx.creditLot.update({
        where: { id: lot.id },
        data: { available: { decrement: used }, held: { increment: used } },
      });
      await tx.creditLotHold.create({
        data: { allocationId, lotId: lot.id, amount: used, remaining: used },
      });
      remaining -= used;
    }
    if (remaining)
      throw new ConflictException("CREDIT_PROVENANCE_BALANCE_MISMATCH");
  }

  async settle(
    tx: TransactionContext,
    userId: string,
    allocationId: string,
    consumed: bigint,
    heldAmount: bigint,
  ) {
    const holds = await tx.creditLotHold.findMany({
      where: { allocationId },
      orderBy: { lotId: "asc" },
    });
    const lots = await tx.creditLot.findMany({
      where: { id: { in: holds.map((h) => h.lotId) }, userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (
      lots.length !== holds.length ||
      holds.reduce((sum, hold) => sum + hold.remaining, 0n) !== heldAmount
    )
      throw new ConflictException("CREDIT_PROVENANCE_HOLD_MISMATCH");
    const ordered = [
      ...lots.filter((lot) => lot.source === "BONUS"),
      ...lots.filter((lot) => lot.source !== "BONUS"),
    ];
    let left = consumed,
      purchased = 0n,
      bonus = 0n;
    for (const lot of ordered) {
      const hold = holds.find((h) => h.lotId === lot.id)!;
      const spent = hold.remaining < left ? hold.remaining : left;
      await tx.creditLot.update({
        where: { id: lot.id },
        data: {
          held: { decrement: hold.remaining },
          available: { increment: hold.remaining - spent },
          consumed: { increment: spent },
        },
      });
      await tx.creditLotHold.update({
        where: { allocationId_lotId: { allocationId, lotId: lot.id } },
        data: { remaining: 0n },
      });
      if (lot.source === "PURCHASED") purchased += spent;
      if (lot.source === "BONUS") bonus += spent;
      left -= spent;
    }
    if (left) throw new ConflictException("CREDIT_PROVENANCE_HOLD_MISMATCH");
    await tx.creditWallet.update({
      where: { userId },
      data: {
        purchasedCredit: { decrement: purchased },
        bonusCredit: { decrement: bonus },
      },
    });
  }
}
