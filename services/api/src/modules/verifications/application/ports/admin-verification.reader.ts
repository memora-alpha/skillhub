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
    page: { receivedAt?: Date; order: "asc" | "desc"; take: number },
  ): Promise<AdminVerificationWorkRow[]>;

  abstract detail(
    tx: TransactionContext,
    id: string,
  ): Promise<AdminVerificationWorkRow | null>;

  abstract pendingCount(tx: TransactionContext): Promise<number>;
}
