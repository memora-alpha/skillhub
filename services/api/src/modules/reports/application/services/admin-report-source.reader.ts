import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  AdminReportReaderPort,
  type AdminReportSourcePage,
} from "../ports/admin-report.reader";

@Injectable()
export class AdminReportSourceReader extends AdminReportReaderPort {
  caseWork(tx: TransactionContext, page: AdminReportSourcePage) {
    return tx.reportCase.findMany({
      where: {
        status: { not: "RESOLVED" },
        ...(page.receivedAt
          ? {
              createdAt:
                page.order === "desc"
                  ? { lte: page.receivedAt }
                  : { gte: page.receivedAt },
            }
          : {}),
      },
      orderBy: [{ createdAt: page.order }, { id: "asc" }],
      take: page.take,
      select: {
        id: true,
        status: true,
        createdAt: true,
        reasonCode: true,
        severity: true,
        handlerId: true,
        version: true,
        relatedPathId: true,
      },
    });
  }

  incidentWork(tx: TransactionContext, page: AdminReportSourcePage) {
    return tx.reportIncident.findMany({
      where: {
        status: "OPEN",
        ...(page.receivedAt
          ? {
              createdAt:
                page.order === "desc"
                  ? { lte: page.receivedAt }
                  : { gte: page.receivedAt },
            }
          : {}),
      },
      orderBy: [{ createdAt: page.order }, { id: "asc" }],
      take: page.take,
      select: {
        id: true,
        status: true,
        createdAt: true,
        reason: true,
        severity: true,
        handlerId: true,
        version: true,
      },
    });
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
