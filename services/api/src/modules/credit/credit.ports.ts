import type { TransactionContext } from "../../infrastructure/database/transaction-context";
import type { PathHoldInput } from "./credit-ledger.service";

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
