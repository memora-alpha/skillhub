import type { AdminWorkSourcePage } from "../../../administration/application/contracts/admin-work-source-page";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

export type AdminCreditWindow = {
  from: Date;
  to: Date;
};

export type AdminSettlementWorkRow = {
  pathId: string;
  checkedAt: Date;
  attemptCount: number;
  outcome: string;
  errorCode: string | null;
};

export abstract class AdminCreditReaderPort {
  abstract settlementWork(
    tx: TransactionContext,
    page: AdminWorkSourcePage,
  ): Promise<AdminSettlementWorkRow[]>;

  abstract settlementDetail(
    tx: TransactionContext,
    pathId: string,
  ): Promise<AdminSettlementWorkRow | null>;

  abstract summary(
    tx: TransactionContext,
    window: AdminCreditWindow,
  ): Promise<{
    topUpCredit: bigint;
    heldCredit: bigint;
    collectedCredit: bigint;
    refundedCredit: bigint;
  }>;

  abstract topUps(
    tx: TransactionContext,
    window: AdminCreditWindow,
  ): Promise<{ createdAt: Date; amount: bigint }[]>;
}
