import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

export type AdminReportSourcePage = {
  receivedAt?: Date;
  order: "asc" | "desc";
  take: number;
};

export type AdminReportCaseWorkRow = {
  id: string;
  status: string;
  createdAt: Date | null;
  reasonCode: string;
  severity: string | null;
  handlerId: string | null;
  version: number;
  relatedPathId: string | null;
};

export type AdminReportIncidentWorkRow = {
  id: string;
  status: string;
  createdAt: Date;
  reason: string;
  severity: string;
  handlerId: string;
  version: number;
};

export abstract class AdminReportReaderPort {
  abstract caseWork(
    tx: TransactionContext,
    page: AdminReportSourcePage,
  ): Promise<AdminReportCaseWorkRow[]>;

  abstract incidentWork(
    tx: TransactionContext,
    page: AdminReportSourcePage,
  ): Promise<AdminReportIncidentWorkRow[]>;

  abstract caseDetail(
    tx: TransactionContext,
    id: string,
  ): Promise<{
    status: string;
    severity: string | null;
    reasonCode: string;
    description: string;
    handlerId: string | null;
    relatedPathId: string | null;
    createdAt: Date | null;
    version: number;
  } | null>;

  abstract incidentDetail(
    tx: TransactionContext,
    id: string,
  ): Promise<{
    status: string;
    severity: string;
    reason: string;
    handlerId: string;
    createdAt: Date;
    version: number;
  } | null>;

  abstract openCounts(tx: TransactionContext): Promise<{
    cases: number;
    incidents: number;
  }>;
}
