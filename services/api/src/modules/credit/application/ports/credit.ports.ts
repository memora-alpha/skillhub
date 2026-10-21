import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { PathHoldInput } from "../contracts/path-credit";

/** Wallet operations the learning-path flow needs (SH-060 owns the implementation). */
export abstract class WalletPort {
  abstract availableBalances(
    tx: TransactionContext,
    userIds: readonly string[],
  ): Promise<{ userId: string; availableCredit: bigint }[]>;

  /** Idempotent per path version: a retry returns the original operation. */
  abstract holdForPath(
    tx: TransactionContext,
    input: PathHoldInput,
  ): Promise<{ operationId: string }>;
}

/** New compensating ledger entries for a decided case; old entries are never edited (SH-068). */
export abstract class CreditAdjustmentPort {
  abstract adjust(
    tx: TransactionContext,
    input: {
      userId: string;
      /** Signed hundredths of a Credit. */
      amount: bigint;
      referenceType: "REPORT_CASE";
      referenceId: string;
      actorId: string;
      reason: string;
      idempotencyKey: string;
    },
  ): Promise<{ operationId: string }>;

  abstract reverse(
    tx: TransactionContext,
    input: {
      operationId: string;
      referenceType: "REPORT_CASE";
      referenceId: string;
      sourceReferenceId: string;
      actorId: string;
      reason: string;
      idempotencyKey: string;
    },
  ): Promise<{ operationId: string }>;
}

/** One-time final settlement of a locked path (SH-067 owns the implementation). */
export abstract class PathSettlementPort {
  abstract settlePath(
    tx: TransactionContext,
    input: {
      pathId: string;
      pathVersion: number;
      exchangeType: "TWO_WAY" | "ONE_WAY";
      now: Date;
    },
  ): Promise<{ operationId: string; gross: bigint; fee: bigint }>;
}
