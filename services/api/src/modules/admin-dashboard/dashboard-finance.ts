import type { TransactionContext } from "../../infrastructure/database/transaction-context";
import { dashboardBuckets, type DashboardPeriod } from "./dashboard-period";
import { readDashboardPayments } from "../payments/application/services/dashboard-payment.reader";
import { formatCredit } from "../credit/domain/money";
import { readRecordedCreditFees } from "../credit/application/services/fee-revenue.reader";

export async function readDashboardFees(
  tx: TransactionContext,
  period: DashboardPeriod,
) {
  const fees = await readRecordedCreditFees(tx, period);
  const byBucket = new Map<string, { collected: bigint; refunded: bigint }>();
  let totalCollected = 0n;
  let totalRefunded = 0n;
  for (const fee of fees) {
    const key =
      period.granularity === "month" ? fee.period.slice(0, -3) : fee.period;
    const bucket = byBucket.get(key) ?? { collected: 0n, refunded: 0n };
    bucket.collected += fee.collected;
    bucket.refunded += fee.refunded;
    byBucket.set(key, bucket);
    totalCollected += fee.collected;
    totalRefunded += fee.refunded;
  }
  return {
    netFeeCredit: formatCredit(totalCollected - totalRefunded),
    feeSeries: dashboardBuckets(period).map((bucket) => {
      const { collected, refunded } = byBucket.get(bucket.key) ?? {
        collected: 0n,
        refunded: 0n,
      };
      return {
        ...bucket,
        collectedCredit: formatCredit(collected),
        refundedCredit: formatCredit(refunded),
        netCredit: formatCredit(collected - refunded),
      };
    }),
  };
}

export async function readDashboardFinance(
  tx: TransactionContext,
  period: DashboardPeriod,
  include = { fees: true, payments: true, attention: true },
) {
  const { netFeeCredit, feeSeries } = include.fees
    ? await readDashboardFees(tx, period)
    : { netFeeCredit: "0.00", feeSeries: [] };
  const payments = include.payments
    ? await readDashboardPayments(tx, period)
    : [];
  const paymentsInReview = include.attention
    ? await tx.payment.count({ where: { status: "REVIEW" } })
    : 0;
  const byBucket = new Map(
    payments.map((row) => [
      period.granularity === "month" ? row.period.slice(0, -3) : row.period,
      row,
    ]),
  );
  let paidOrders = 0;
  let paidAmount = 0n;
  let paidCredit = 0n;
  const paymentSeries = (include.payments ? dashboardBuckets(period) : []).map(
    (bucket) => {
      const payment = byBucket.get(bucket.key);
      const orders = Number(payment?.orders ?? 0);
      const vnd = BigInt(payment?.vnd ?? 0);
      const credit = BigInt(payment?.credit ?? 0);
      paidOrders += orders;
      paidAmount += vnd;
      paidCredit += credit;
      return {
        ...bucket,
        paidOrders: orders,
        paidAmountVnd: vnd.toString(),
        paidCreditAmount: formatCredit(credit),
      };
    },
  );
  return {
    kpis: {
      paidOrders,
      paidAmountVnd: paidAmount.toString(),
      paidCreditAmount: formatCredit(paidCredit),
      netFeeCredit,
    },
    feeSeries,
    paymentSeries,
    attentionSummary: { paymentsInReview },
  };
}
