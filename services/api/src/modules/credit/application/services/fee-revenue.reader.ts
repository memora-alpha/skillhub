import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

export function readRecordedCreditFees(
  tx: TransactionContext,
  {
    from,
    to,
    granularity,
    timezone,
  }: {
    from: Date;
    to: Date;
    granularity: "day" | "month";
    timezone: string;
  },
) {
  return tx.$queryRaw<
    { period: string; business: string; collected: string; refunded: string }[]
  >`
    WITH events AS (
      SELECT t.created_at AS at, o.operation_type AS business, t.amount::numeric AS collected, 0::numeric AS refunded
      FROM credit_transactions t JOIN credit_operations o ON o.operation_id=t.operation_id
      WHERE t.type='PLATFORM_FEE' AND t.status='SUCCESS' AND o.status='SUCCESS'
        AND t.created_at >= ${from} AND t.created_at < ${to}
      UNION ALL
      SELECT o.created_at AS at, 'MATERIAL_PURCHASE' AS business, 0::numeric AS collected,
        SUM(t.available_delta::numeric) AS refunded
      FROM credit_operations o JOIN credit_transactions t ON t.operation_id=o.operation_id
      WHERE o.operation_type='MATERIAL_REFUND' AND o.status='SUCCESS' AND t.status='SUCCESS'
        AND o.created_at >= ${from} AND o.created_at < ${to}
      GROUP BY o.operation_id, o.created_at
    )
    SELECT to_char(date_trunc(${granularity}::text, at AT TIME ZONE ${timezone}::text), 'YYYY-MM-DD') AS period,
      business, SUM(collected)::text AS collected, SUM(refunded)::text AS refunded
    FROM events GROUP BY 1, 2 ORDER BY 1, 2
  `.then((rows) =>
    rows.map((row) => ({
      ...row,
      collected: BigInt(row.collected),
      refunded: BigInt(row.refunded),
    })),
  );
}
