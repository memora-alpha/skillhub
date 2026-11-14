import type { TransactionContext } from "../../infrastructure/database/transaction-context";
import { Prisma } from "../../generated/prisma/client";
import { OPEN_REPORT_STATUSES } from "../reports/domain/report-support.policy";

export const dashboardQueuePermissions = [
  "skill-verification:read",
  "learning-request:moderation:read",
  "material:moderate",
  "tag-request:read",
  "report:moderate",
] as const;

export async function readDashboardAttention(tx: TransactionContext) {
  const attentionSummary = {
    SKILL_VERIFICATION: 0,
    LEARNING_REQUEST: 0,
    MATERIAL: 0,
    TAG_REQUEST: 0,
    REPORT_CASE: 0,
  };
  const rows = await tx.$queryRaw<
    {
      type: keyof typeof attentionSummary;
      id: string;
      status: string;
      label: string | null;
      createdAt: Date | null;
      total: bigint;
    }[]
  >`
    WITH queue AS (
      SELECT 'SKILL_VERIFICATION' AS type, verification_id AS id, status::text, NULL::text AS label,
        submitted_at AS created_at FROM skill_verifications WHERE status = 'PENDING'
      UNION ALL
      SELECT 'LEARNING_REQUEST', request_id, status::text, title, created_at
      FROM learning_requests WHERE status = 'PENDING_MODERATION'
      UNION ALL
      SELECT 'MATERIAL', material_id, status::text, title, created_at
      FROM materials WHERE status = 'PENDING_REVIEW'
      UNION ALL
      SELECT 'TAG_REQUEST', tag_request_id, status::text, label, created_at
      FROM tag_creation_requests WHERE status = 'PENDING'
      UNION ALL
      SELECT 'REPORT_CASE', case_id, status::text, reason_code, created_at
      FROM report_cases WHERE status::text IN (${Prisma.join(OPEN_REPORT_STATUSES)})
    ), ranked AS (
      SELECT *, COUNT(*) OVER (PARTITION BY type) AS total,
        row_number() OVER (PARTITION BY type ORDER BY created_at DESC NULLS LAST, id DESC) AS position
      FROM queue
    )
    SELECT type, id, status, label, created_at AS "createdAt", total
    FROM ranked WHERE position <= 10 ORDER BY created_at DESC NULLS LAST, type ASC, id DESC
  `;
  for (const row of rows) attentionSummary[row.type] = Number(row.total);
  const priorityItems = rows
    .slice(0, 10)
    .map(({ type, id, status, label, createdAt }) => ({
      type,
      id,
      status,
      label,
      createdAt,
    }));
  return { attentionSummary, priorityItems };
}
