import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { auditContext } from "../../../materials/application/services/material-support";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  compareWorkKey,
  decodeWorkCursor,
  encodeWorkCursor,
} from "../../domain/admin-work-item-cursor";
import type { WORK_ITEM_KINDS } from "../../presentation/http/admin-operations.dto";
import type { AdminWorkSourcePage } from "../contracts/admin-work-source-page";
import { AdminPaymentReaderPort } from "../../../payments/application/ports/admin-payment.reader";
import { AdminCreditReaderPort } from "../../../credit/application/ports/admin-credit.reader";
import { AdminReportReaderPort } from "../../../reports/application/ports/admin-report.reader";
import { AdminLearningPathReaderPort } from "../../../learning-paths/application/ports/admin-learning-path.reader";
import { AdminVerificationReaderPort } from "../../../verifications/application/ports/admin-verification.reader";
import { AdminTagRequestReaderPort } from "../../../skills/application/ports/admin-tag-request.reader";

type WorkKind = (typeof WORK_ITEM_KINDS)[number];
type WorkItem = {
  id: string;
  kind: WorkKind;
  displayCode: string;
  title: string;
  severity: string;
  reason: string | null;
  status: string;
  waitingOn: string;
  assignee: string | null;
  receivedAt: Date;
  waitingSince: Date;
  related: Record<string, string | null>;
  version: number;
  openTarget: string;
  allowedActions: string[];
};

@Injectable()
export class AdminWorkItemsReader {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly payments: AdminPaymentReaderPort,
    private readonly credit: AdminCreditReaderPort,
    private readonly reports: AdminReportReaderPort,
    private readonly paths: AdminLearningPathReaderPort,
    private readonly verifications: AdminVerificationReaderPort,
    private readonly tags: AdminTagRequestReaderPort,
  ) {}

  async list(query: {
    limit?: number;
    cursor?: string;
    kind?: WorkKind;
    severity?: string;
    waitingOn?: string;
    assignee?: string;
    minAgeHours?: number;
    q?: string;
    sort?: "oldest" | "newest";
  }) {
    const limit = query.limit ?? 20;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException("INVALID_PAGE_LIMIT");
    const scope = JSON.stringify([
      "admin-work-v1",
      query.kind ?? null,
      query.severity ?? null,
      query.waitingOn ?? null,
      query.assignee ?? null,
      query.minAgeHours ?? null,
      query.q?.trim().toLowerCase() ?? null,
      query.sort ?? "oldest",
    ]);
    const cursor = decodeWorkCursor(query.cursor, scope);
    const newest = query.sort === "newest";
    const { now, sourceItems } = await this.transactions.run(async (tx) => {
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (!(clock?.now instanceof Date))
        throw new Error("DATABASE_TIME_UNAVAILABLE");
      return {
        now: clock.now,
        sourceItems: await this.sources(tx, query.kind, {
          cursor,
          order: newest ? "desc" : "asc",
          take: limit + 1,
          filters: {
            severity: query.severity,
            waitingOn: query.waitingOn,
            assignee: query.assignee,
            q: query.q,
            ...(query.minAgeHours === undefined
              ? {}
              : {
                  waitingBefore: new Date(
                    clock.now.getTime() - query.minAgeHours * 3_600_000,
                  ),
                }),
          },
        }),
      };
    });
    const items = sourceItems;
    items.sort((left, right) => compareWorkKey(left, right, newest));
    const after = cursor
      ? items.filter((item) => compareWorkKey(item, cursor, newest) > 0)
      : items;
    const data = after.slice(0, limit);
    const last = data.at(-1);
    return {
      data: data.map((item) => ({
        ...item,
        ageSeconds: Math.max(
          0,
          Math.floor((now.getTime() - item.waitingSince.getTime()) / 1000),
        ),
      })),
      pagination: {
        limit,
        hasMore: after.length > limit,
        nextCursor:
          after.length > limit && last
            ? encodeWorkCursor({
                scope,
                receivedAt: last.receivedAt,
                kind: last.kind,
                id: last.id,
              })
            : null,
      },
    };
  }

  detail(principal: Principal, kind: WorkKind, id: string) {
    return this.transactions.run(async (tx) => {
      const data = await this.readDetail(tx, kind, id);
      if (!data) throw new NotFoundException("ADMIN_WORK_ITEM_NOT_FOUND");
      await this.audit.append(tx, {
        actor: {
          kind: "HUMAN",
          userId: principal.userId,
          roles: principal.roles as ("USER" | "STAFF" | "ADMIN")[],
        },
        action: "ADMIN_WORK_ITEM_READ",
        target: { type: kind, id },
        after: { kind, id },
        reason: "Admin work item detail read",
        context: auditContext(),
      });
      return { kind, id, ...data };
    });
  }

  private async sources(
    tx: TransactionContext,
    kind: WorkKind | undefined,
    page: AdminWorkSourcePage,
  ): Promise<WorkItem[]> {
    const selected = <T>(source: WorkKind, read: () => Promise<T[]>) =>
      !kind || kind === source ? read() : Promise.resolve([]);
    const [
      payments,
      settlements,
      cases,
      incidents,
      terminations,
      verifications,
      tags,
    ] = await Promise.all([
      selected("PAYMENT_REVIEW", async () =>
        (await this.payments.reviewWork(tx, page)).map((row) =>
          item(
            "PAYMENT_REVIEW",
            row.id,
            `Payment ${row.id.slice(0, 8)}`,
            row.status,
            row.createdAt,
            null,
            null,
            null,
            1,
            `/admin/payments/${row.id}`,
          ),
        ),
      ),
      selected("SETTLEMENT_REVIEW", async () =>
        (await this.credit.settlementWork(tx, page)).map((row) =>
          item(
            "SETTLEMENT_REVIEW",
            row.pathId,
            `Settlement ${row.pathId.slice(0, 8)}`,
            row.outcome,
            row.checkedAt,
            row.errorCode,
            null,
            null,
            row.attemptCount,
            `/admin/learning-paths/${row.pathId}`,
          ),
        ),
      ),
      selected("REPORT_CASE", async () =>
        (await this.reports.caseWork(tx, page)).map((row) =>
          item(
            "REPORT_CASE",
            row.id,
            `Report case ${row.id.slice(0, 8)}`,
            row.status,
            row.createdAt ?? new Date(0),
            row.reasonCode,
            row.severity ?? "UNCLASSIFIED",
            row.handlerId,
            row.version,
            `/staff/report-cases/${row.id}`,
            { pathId: row.relatedPathId },
          ),
        ),
      ),
      selected("REPORT_INCIDENT", async () =>
        (await this.reports.incidentWork(tx, page)).map((row) =>
          item(
            "REPORT_INCIDENT",
            row.id,
            `Report incident ${row.id.slice(0, 8)}`,
            row.status,
            row.createdAt,
            row.reason,
            row.severity,
            row.handlerId,
            row.version,
            `/staff/report-incidents/${row.id}`,
          ),
        ),
      ),
      selected("PATH_TERMINATION", async () =>
        (await this.paths.terminationWork(tx, page)).map((row) =>
          item(
            "PATH_TERMINATION",
            row.id,
            `Path termination ${row.pathId.slice(0, 8)}`,
            row.status,
            row.createdAt,
            row.reason,
            "UNCLASSIFIED",
            row.resolvedByUserId,
            row.version,
            `/admin/learning-paths/${row.pathId}`,
            { pathId: row.pathId },
          ),
        ),
      ),
      selected("SKILL_VERIFICATION", async () =>
        (await this.verifications.pendingWork(tx, page)).map((row) =>
          item(
            "SKILL_VERIFICATION",
            row.id,
            `Skill verification ${row.id.slice(0, 8)}`,
            row.status,
            row.submittedAt,
            null,
            "UNCLASSIFIED",
            row.reviewerId,
            row.version,
            `/staff/skill-verifications/${row.id}`,
          ),
        ),
      ),
      selected("TAG_REQUEST", async () =>
        (await this.tags.pendingWork(tx, page)).map((row) =>
          item(
            "TAG_REQUEST",
            row.id,
            row.label,
            row.status,
            row.createdAt,
            null,
            "UNCLASSIFIED",
            row.reviewedByUserId,
            row.version,
            `/admin/tag-requests/${row.id}`,
          ),
        ),
      ),
    ]);
    return [
      ...payments,
      ...settlements,
      ...cases,
      ...incidents,
      ...terminations,
      ...verifications,
      ...tags,
    ];
  }

  private readDetail(tx: TransactionContext, kind: WorkKind, id: string) {
    if (kind === "PAYMENT_REVIEW") return this.payments.reviewDetail(tx, id);
    if (kind === "SETTLEMENT_REVIEW")
      return this.credit.settlementDetail(tx, id);
    if (kind === "REPORT_CASE") return this.reports.caseDetail(tx, id);
    if (kind === "REPORT_INCIDENT") return this.reports.incidentDetail(tx, id);
    if (kind === "PATH_TERMINATION")
      return this.paths.terminationDetail(tx, id);
    if (kind === "SKILL_VERIFICATION") return this.verifications.detail(tx, id);
    if (kind === "TAG_REQUEST") return this.tags.detail(tx, id);
    return Promise.resolve(null);
  }
}
function item(
  kind: WorkKind,
  id: string,
  title: string,
  status: string,
  receivedAt: Date,
  reason: string | null,
  severity: string | null,
  assignee: string | null,
  version: number,
  openTarget: string,
  related: Record<string, string | null> = {},
): WorkItem {
  return {
    id,
    kind,
    displayCode: `${kind}-${id.slice(0, 8).toUpperCase()}`,
    title,
    severity: severity ?? "UNCLASSIFIED",
    reason,
    status,
    waitingOn: assignee ? "ASSIGNEE" : "ADMIN",
    assignee,
    receivedAt,
    waitingSince: receivedAt,
    related,
    version,
    openTarget,
    allowedActions: [],
  };
}
