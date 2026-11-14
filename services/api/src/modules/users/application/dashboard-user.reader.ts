import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import {
  dashboardBuckets,
  type DashboardPeriod,
} from "../../admin-dashboard/dashboard-period";

export async function readDashboardUserGrowth(
  tx: TransactionContext,
  period: DashboardPeriod,
) {
  const { from, to, timezone, granularity } = period;
  const rows = await tx.$queryRaw<{ key: string; count: bigint }[]>`
    SELECT to_char(date_trunc(${granularity}::text, u.created_at AT TIME ZONE ${timezone}::text),
      CASE WHEN ${granularity}::text = 'month' THEN 'YYYY-MM' ELSE 'YYYY-MM-DD' END) AS key,
      count(*) AS count
    FROM users u JOIN roles r ON r.role_id = u.role_id
    WHERE r.code = 'USER' AND u.created_at >= ${from} AND u.created_at < ${to}
    GROUP BY 1
  `;
  const byKey = new Map(rows.map(({ key, count }) => [key, Number(count)]));
  return dashboardBuckets(period).map((bucket) => ({
    ...bucket,
    newUsers: byKey.get(bucket.key) ?? 0,
  }));
}
