import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  dashboardBuckets,
  type DashboardPeriod,
} from "../../../admin-dashboard/dashboard-period";

export async function readDashboardLearning(
  tx: TransactionContext,
  period: DashboardPeriod,
) {
  const { from, to, timezone, granularity } = period;
  const rows = await tx.$queryRaw<
    {
      kind: "path" | "session" | "settled";
      key: string;
      status: string;
      count: bigint;
    }[]
  >`
    WITH events AS (
      SELECT 'path' AS kind, created_at AS at, status::text AS status
      FROM learning_paths WHERE created_at >= ${from} AND created_at < ${to}
      UNION ALL
      SELECT 'settled', settled_at, ''
      FROM learning_paths WHERE settled_at >= ${from} AND settled_at < ${to}
      UNION ALL
      SELECT 'session', start_at, status::text
      FROM sessions WHERE start_at >= ${from} AND start_at < ${to}
    )
    SELECT kind, to_char(date_trunc(${granularity}::text, at AT TIME ZONE ${timezone}::text),
      CASE WHEN ${granularity}::text = 'month' THEN 'YYYY-MM' ELSE 'YYYY-MM-DD' END) AS key,
      status, count(*) AS count
    FROM events GROUP BY 1, 2, 3
  `;
  const kpis = {
    pathsCreated: 0,
    pathsSettled: 0,
    sessionsScheduled: 0,
    completedScheduledSessions: 0,
  };
  const learningActivity = dashboardBuckets(period).map((bucket) => ({
    ...bucket,
    ...kpis,
  }));
  const bucketByKey = new Map(
    learningActivity.map((bucket) => [bucket.key, bucket]),
  );
  const stages = new Map<string, number>();
  for (const row of rows) {
    const bucket = bucketByKey.get(row.key);
    if (!bucket) continue;
    const count = Number(row.count);
    if (row.kind === "path") {
      bucket.pathsCreated += count;
      kpis.pathsCreated += count;
      stages.set(row.status, (stages.get(row.status) ?? 0) + count);
    } else if (row.kind === "settled") {
      bucket.pathsSettled += count;
      kpis.pathsSettled += count;
    } else {
      bucket.sessionsScheduled += count;
      kpis.sessionsScheduled += count;
      if (row.status === "COMPLETED") {
        bucket.completedScheduledSessions += count;
        kpis.completedScheduledSessions += count;
      }
    }
  }
  return {
    kpis,
    learningActivity,
    pathStages: [...stages]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([status, count]) => ({ status, count })),
  };
}
