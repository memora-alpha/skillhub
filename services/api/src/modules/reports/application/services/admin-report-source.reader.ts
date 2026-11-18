import { Prisma } from "../../../../generated/prisma/client";
import {
  adminWorkSourceQuery,
  type AdminWorkSourcePage,
} from "../../../administration/application/contracts/admin-work-source-page";
import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  AdminReportReaderPort,
  type AdminReportCaseWorkRow,
  type AdminReportIncidentWorkRow,
} from "../ports/admin-report.reader";

@Injectable()
export class AdminReportSourceReader extends AdminReportReaderPort {
  caseWork(tx: TransactionContext, page: AdminWorkSourcePage) {
    return tx.$queryRaw<AdminReportCaseWorkRow[]>(
      adminWorkSourceQuery(
        Prisma.sql`SELECT
        case_id AS id,
        status::text AS status,
        created_at AS "createdAt",
        coalesce(created_at, '1970-01-01T00:00:00Z'::timestamptz) AS "receivedAt",
        reason_code AS "reasonCode",
        coalesce(severity, 'UNCLASSIFIED') AS severity,
        handler_id AS "handlerId",
        version,
        related_path_id AS "relatedPathId",
        'Report case ' || left(case_id::text, 8) AS title,
        reason_code AS reason,
        handler_id AS assignee
      FROM report_cases WHERE status <> 'RESOLVED'`,
        "REPORT_CASE",
        page,
      ),
    );
  }

  incidentWork(tx: TransactionContext, page: AdminWorkSourcePage) {
    return tx.$queryRaw<AdminReportIncidentWorkRow[]>(
      adminWorkSourceQuery(
        Prisma.sql`SELECT
        id,
        status,
        created_at AS "createdAt",
        created_at AS "receivedAt",
        reason,
        severity,
        handler_id AS "handlerId",
        version,
        'Report incident ' || left(id::text, 8) AS title,
        handler_id AS assignee
      FROM report_incidents WHERE status = 'OPEN'`,
        "REPORT_INCIDENT",
        page,
      ),
    );
  }

  caseDetail(tx: TransactionContext, id: string) {
    return tx.reportCase.findUnique({
      where: { id },
      select: {
        status: true,
        severity: true,
        reasonCode: true,
        description: true,
        handlerId: true,
        relatedPathId: true,
        createdAt: true,
        version: true,
      },
    });
  }

  incidentDetail(tx: TransactionContext, id: string) {
    return tx.reportIncident.findUnique({
      where: { id },
      select: {
        status: true,
        severity: true,
        reason: true,
        handlerId: true,
        createdAt: true,
        version: true,
      },
    });
  }

  async openCounts(tx: TransactionContext) {
    const [cases, incidents] = await Promise.all([
      tx.reportCase.count({ where: { status: { not: "RESOLVED" } } }),
      tx.reportIncident.count({ where: { status: "OPEN" } }),
    ]);
    return { cases, incidents };
  }
}
