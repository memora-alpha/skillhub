import type { AdminWorkSourcePage } from "../../../administration/application/contracts/admin-work-source-page";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

export type AdminVerificationWorkRow = {
  id: string;
  sharingSkillId: string;
  status: string;
  reviewerId: string | null;
  note: string | null;
  submittedAt: Date;
  version: number;
};

export abstract class AdminVerificationReaderPort {
  abstract pendingWork(
    tx: TransactionContext,
    page: AdminWorkSourcePage,
  ): Promise<AdminVerificationWorkRow[]>;

  abstract detail(
    tx: TransactionContext,
    id: string,
  ): Promise<AdminVerificationWorkRow | null>;

  abstract pendingCount(tx: TransactionContext): Promise<number>;
}
