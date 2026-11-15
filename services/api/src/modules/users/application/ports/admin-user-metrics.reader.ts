import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

export type AdminMetricWindow = {
  from: Date;
  to: Date;
};

export abstract class AdminUserMetricsReaderPort {
  abstract summary(
    tx: TransactionContext,
    window: AdminMetricWindow,
  ): Promise<{
    totalUsers: number;
    newUsers: number;
    statusBreakdown: Record<string, number>;
  }>;

  abstract createdAt(
    tx: TransactionContext,
    window: AdminMetricWindow,
  ): Promise<Date[]>;
}
