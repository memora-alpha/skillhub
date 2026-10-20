import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type {
  LedgerBoundary,
  LedgerEntry,
  LedgerFilter,
  WalletRecord,
} from "../contracts/wallet";

export abstract class WalletRepository {
  abstract get(
    tx: TransactionContext,
    userId: string,
  ): Promise<WalletRecord | null>;
  abstract ensure(
    tx: TransactionContext,
    userId: string,
  ): Promise<WalletRecord>;
  abstract list(
    tx: TransactionContext,
    userId: string,
    filter: LedgerFilter,
    boundary: LedgerBoundary,
    limit: number,
  ): Promise<LedgerEntry[]>;
  abstract detail(
    tx: TransactionContext,
    userId: string,
    id: string,
  ): Promise<LedgerEntry | null>;
}
