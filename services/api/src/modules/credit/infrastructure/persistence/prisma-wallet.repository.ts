import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type {
  LedgerBoundary,
  LedgerEntry,
  LedgerFilter,
  WalletRecord,
} from "../../application/contracts/wallet";
import { WalletRepository } from "../../application/ports/wallet-repository";
const ledgerProjection = {
  id: true,
  operationId: true,
  type: true,
  amount: true,
  availableDelta: true,
  heldDelta: true,
  availableAfter: true,
  heldAfter: true,
  status: true,
  reversesTransactionId: true,
  createdAt: true,
  entrySequence: true,
  operationIdRecord: { select: { referenceType: true, referenceId: true } },
} as const;

@Injectable()
export class PrismaWalletRepository extends WalletRepository {
  get(tx: TransactionContext, userId: string): Promise<WalletRecord | null> {
    return tx.creditWallet.findUnique({ where: { userId } });
  }

  ensure(tx: TransactionContext, userId: string): Promise<WalletRecord> {
    return tx.creditWallet.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        availableCredit: 0n,
        heldCredit: 0n,
        purchasedCredit: 0n,
        bonusCredit: 0n,
        walletVersion: 0,
      },
    });
  }

  async list(
    tx: TransactionContext,
    userId: string,
    filter: LedgerFilter,
    boundary: LedgerBoundary,
    limit: number,
  ): Promise<LedgerEntry[]> {
    const rows = await tx.creditTransaction.findMany({
      where: {
        userId,
        type: filter.type,
        operationIdRecord: { referenceType: filter.referenceType },
        entrySequence: {
          lte: boundary.watermark,
          ...(boundary.before === undefined ? {} : { lt: boundary.before }),
        },
      },
      select: ledgerProjection,
      orderBy: { entrySequence: "desc" },
      take: limit + 1,
    });
    return rows.map(({ operationIdRecord, ...entry }) => ({
      ...entry,
      ...operationIdRecord,
    }));
  }

  async detail(
    tx: TransactionContext,
    userId: string,
    id: string,
  ): Promise<LedgerEntry | null> {
    const row = await tx.creditTransaction.findFirst({
      where: { userId, id },
      select: ledgerProjection,
    });
    if (!row) return null;
    const { operationIdRecord, ...entry } = row;
    return { ...entry, ...operationIdRecord };
  }
}
