import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { DashboardPeriod } from "../../../admin-dashboard/dashboard-period";

export function readDashboardPayments(
  tx: TransactionContext,
  period: DashboardPeriod,
) {
  const { from, to, granularity, timezone } = period;
  return tx.$queryRaw<
    { period: string; orders: bigint; vnd: string; credit: string }[]
  >`
    SELECT to_char(date_trunc(${granularity}::text, c.paid_at AT TIME ZONE ${timezone}::text), 'YYYY-MM-DD') AS period,
      count(*) AS orders, sum(p.payment_amount_vnd)::text AS vnd, sum(p.credit_amount)::text AS credit
    FROM payments p JOIN payos_checkouts c ON c.payment_id = p.payment_id
    WHERE p.status = 'PAID' AND c.paid_at >= ${from} AND c.paid_at < ${to}
    GROUP BY 1 ORDER BY 1
  `;
}
