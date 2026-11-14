import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
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
    private readonly db: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
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
    const now = await this.databaseNow();
    const items = (await this.sources(query.kind, cursor, newest)).filter(
      (item) => {
        if (query.severity && item.severity !== query.severity) return false;
        if (query.waitingOn && item.waitingOn !== query.waitingOn) return false;
        if (query.assignee && item.assignee !== query.assignee) return false;
        if (
          query.minAgeHours !== undefined &&
          now.getTime() - item.waitingSince.getTime() <
            query.minAgeHours * 3_600_000
        )
          return false;
        const q = query.q?.trim().toLowerCase();
        return (
          !q ||
          `${item.displayCode} ${item.title} ${item.reason ?? ""}`
            .toLowerCase()
            .includes(q)
        );
      },
    );
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
      const data = await readDetail(tx, kind, id);
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
    kind: WorkKind | undefined,
    cursor: ReturnType<typeof decodeWorkCursor>,
    newest: boolean,
  ): Promise<WorkItem[]> {
    const selected = <T>(source: WorkKind, read: () => Promise<T[]>) =>
      !kind || kind === source ? read() : Promise.resolve([]);
    const dateBoundary = cursor
      ? newest
        ? { lte: cursor.receivedAt }
        : { gte: cursor.receivedAt }
      : undefined;
    const order = newest ? ("desc" as const) : ("asc" as const);
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
        (
          await this.db.payment.findMany({
            where: { status: "REVIEW", createdAt: dateBoundary },
            orderBy: [{ createdAt: order }, { id: "asc" }],
            take: 101,
          })
        ).map((row) =>
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
        (
          await this.db.pathSettlementAttempt.findMany({
            where: { errorCode: { not: null }, checkedAt: dateBoundary },
            orderBy: [{ checkedAt: order }, { pathId: "asc" }],
            take: 101,
          })
        ).map((row) =>
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
        (
          await this.db.reportCase.findMany({
            where: { status: { not: "RESOLVED" }, createdAt: dateBoundary },
            orderBy: [{ createdAt: order }, { id: "asc" }],
            take: 101,
          })
        ).map((row) =>
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
        (
          await this.db.reportIncident.findMany({
            where: { status: "OPEN", createdAt: dateBoundary },
            orderBy: [{ createdAt: order }, { id: "asc" }],
            take: 101,
          })
        ).map((row) =>
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
        (
          await this.db.learningChangeRequest.findMany({
            where: {
              kind: "PATH_TERMINATION",
              status: { in: ["PENDING", "STAFF_REVIEW"] },
              createdAt: dateBoundary,
            },
            orderBy: [{ createdAt: order }, { id: "asc" }],
            take: 101,
          })
        ).map((row) =>
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
        (
          await this.db.skillVerification.findMany({
            where: { status: "PENDING", submittedAt: dateBoundary },
            orderBy: [{ submittedAt: order }, { id: "asc" }],
            take: 101,
          })
        ).map((row) =>
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
        (
          await this.db.tagCreationRequest.findMany({
            where: { status: "PENDING", createdAt: dateBoundary },
            orderBy: [{ createdAt: order }, { id: "asc" }],
            take: 101,
          })
        ).map((row) =>
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

  private async databaseNow() {
    const [row] = await this.db.$queryRaw<
      { now: Date }[]
    >`SELECT CURRENT_TIMESTAMP AS now`;
    if (!(row?.now instanceof Date))
      throw new Error("DATABASE_TIME_UNAVAILABLE");
    return row.now;
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

async function readDetail(tx: TransactionContext, kind: WorkKind, id: string) {
  if (kind === "PAYMENT_REVIEW")
    return tx.payment.findUnique({
      where: { id },
      select: {
        status: true,
        creditAmount: true,
        paymentAmountVnd: true,
        currency: true,
        gateway: true,
        createdAt: true,
      },
    });
  if (kind === "SETTLEMENT_REVIEW")
    return tx.pathSettlementAttempt.findUnique({
      where: { pathId: id },
      select: {
        outcome: true,
        errorCode: true,
        attemptCount: true,
        checkedAt: true,
      },
    });
  if (kind === "REPORT_CASE")
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
  if (kind === "REPORT_INCIDENT")
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
  if (kind === "PATH_TERMINATION")
    return tx.learningChangeRequest.findUnique({
      where: { id },
      select: {
        pathId: true,
        status: true,
        reason: true,
        requesterId: true,
        createdAt: true,
        expiresAt: true,
        version: true,
      },
    });
  if (kind === "SKILL_VERIFICATION")
    return tx.skillVerification.findUnique({
      where: { id },
      select: {
        sharingSkillId: true,
        status: true,
        reviewerId: true,
        note: true,
        submittedAt: true,
        version: true,
      },
    });
  if (kind === "TAG_REQUEST")
    return tx.tagCreationRequest.findUnique({
      where: { id },
      select: {
        label: true,
        status: true,
        requestedByUserId: true,
        reviewedByUserId: true,
        createdAt: true,
        version: true,
      },
    });
  return null;
}
