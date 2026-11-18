import type { AdminWorkSourcePage } from "../../../administration/application/contracts/admin-work-source-page";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

export type AdminTagRequestWorkRow = {
  id: string;
  label: string;
  status: string;
  requestedByUserId: string;
  reviewedByUserId: string | null;
  createdAt: Date;
  version: number;
};

export abstract class AdminTagRequestReaderPort {
  abstract pendingWork(
    tx: TransactionContext,
    page: AdminWorkSourcePage,
  ): Promise<AdminTagRequestWorkRow[]>;

  abstract detail(
    tx: TransactionContext,
    id: string,
  ): Promise<AdminTagRequestWorkRow | null>;

  abstract pendingCount(tx: TransactionContext): Promise<number>;
}
