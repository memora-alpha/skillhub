import { Injectable } from "@nestjs/common";
import {
  AdminUserMetricsReaderPort,
  type AdminMetricWindow,
} from "../ports/admin-user-metrics.reader";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

@Injectable()
export class AdminUserMetricsReader extends AdminUserMetricsReaderPort {
  async summary(tx: TransactionContext, window: AdminMetricWindow) {
    const [totalUsers, newUsers, statuses] = await Promise.all([
      tx.user.count({ where: { roleIdRecord: { code: "USER" } } }),
      tx.user.count({
        where: {
          roleIdRecord: { code: "USER" },
          createdAt: { gte: window.from, lt: window.to },
        },
      }),
      tx.user.groupBy({
        by: ["accountStatus"],
        where: { roleIdRecord: { code: "USER" } },
        _count: { _all: true },
      }),
    ]);
    return {
      totalUsers,
      newUsers,
      statusBreakdown: Object.fromEntries(
        statuses.map((row) => [row.accountStatus, row._count._all]),
      ),
    };
  }

  async createdAt(tx: TransactionContext, window: AdminMetricWindow) {
    const rows = await tx.user.findMany({
      where: {
        roleIdRecord: { code: "USER" },
        createdAt: { gte: window.from, lt: window.to },
      },
      select: { createdAt: true },
    });
    return rows.map((row) => row.createdAt);
  }
}
