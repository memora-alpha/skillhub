import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

export type AdminSourcePage = {
  receivedAt?: Date;
  order: "asc" | "desc";
  take: number;
};

export type AdminPaymentWorkRow = {
  id: string;
  status: string;
  createdAt: Date;
};

export abstract class AdminPaymentReaderPort {
  abstract reviewWork(
    tx: TransactionContext,
    page: AdminSourcePage,
  ): Promise<AdminPaymentWorkRow[]>;

  abstract reviewDetail(
    tx: TransactionContext,
    id: string,
  ): Promise<{
    status: string;
    creditAmount: bigint;
    paymentAmountVnd: bigint;
    currency: string;
    gateway: string;
    createdAt: Date;
  } | null>;

  abstract reviewCount(tx: TransactionContext): Promise<number>;
}
