import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import { ReportsService } from "./reports.service";
import { lockLearningPath } from "../../../learning-paths/application/services/learning-path-lock";
import {
  assertIndependentCaseActor,
  assertSameIncident,
  OPEN_REPORT_STATUSES,
} from "../../domain/report-support.policy";
import type { ReportCaseActionDto } from "../../presentation/http/reports.dto";
import { AuditService } from "../../../audit/application/services/audit.service";
import { z } from "zod";
import type { ReportCase } from "../../../../generated/prisma/client";

type CaseParties = Pick<
  ReportCase,
  "reporterId" | "targetType" | "targetId" | "relatedPathId" | "relatedOrderId"
>;

@Injectable()
export class ReportSupportService {
  async auditEvidenceRead(
    tx: TransactionContext,
    actorId: string,
    evidenceId: string,
  ) {
    await this.audit(
      tx,
      actorId,
      evidenceId,
      "CASE_EVIDENCE_READ",
      "Read private case evidence",
      { access: "READ" },
    );
  }
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly actors: SkillActorService,
    private readonly reports: ReportsService,
    private readonly auditLog: AuditService,
  ) {}
  async staff(
    tx: TransactionContext,
    principal: Principal,
    permission: string,
  ) {
    const actor = await this.actors.require(tx, principal, permission);
    if (
      !actor.roles.some((role) => role === "ADMIN" || role === "STAFF") ||
      !actor.permissions.has("report:moderate") ||
      actor.blockedPermissions.has("report:moderate")
    )
      throw new ForbiddenException("REPORT_STAFF_PERMISSION_REQUIRED");
    return actor;
  }
  async parties(tx: TransactionContext, caseId: string) {
    const item = await tx.reportCase.findUnique({ where: { id: caseId } });
    if (!item) throw new NotFoundException("REPORT_CASE_NOT_FOUND");
    const parties = new Set<string>(item.reporterId ? [item.reporterId] : []);
    if (item.relatedPathId) {
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: item.relatedPathId },
        select: { participantAId: true, participantBId: true },
      });
      parties.add(path.participantAId);
      parties.add(path.participantBId);
    }
    if (item.relatedOrderId) {
      const order = await tx.materialOrder.findUniqueOrThrow({
        where: { id: item.relatedOrderId },
        select: { buyerId: true, sellerId: true },
      });
      parties.add(order.buyerId);
      parties.add(order.sellerId);
    }
    if (item.targetType === "USER") parties.add(item.targetId);
    return { item, parties: [...parties] };
  }
  /** Batch related parties before validating every case; do not issue one read per case. */
  private async assertIndependentCases(
    tx: TransactionContext,
    actorId: string,
    cases: CaseParties[],
  ) {
    const pathIds = [
      ...new Set(
        cases.flatMap((item) =>
          item.relatedPathId ? [item.relatedPathId] : [],
        ),
      ),
    ];
    const orderIds = [
      ...new Set(
        cases.flatMap((item) =>
          item.relatedOrderId ? [item.relatedOrderId] : [],
        ),
      ),
    ];
    const [paths, orders] = await Promise.all([
      pathIds.length
        ? tx.learningPath.findMany({
            where: { id: { in: pathIds } },
            select: { id: true, participantAId: true, participantBId: true },
          })
        : [],
      orderIds.length
        ? tx.materialOrder.findMany({
            where: { id: { in: orderIds } },
            select: { id: true, buyerId: true, sellerId: true },
          })
        : [],
    ]);
    const pathById = new Map(paths.map((row) => [row.id, row]));
    const orderById = new Map(orders.map((row) => [row.id, row]));
    for (const item of cases) {
      const parties = new Set<string>(item.reporterId ? [item.reporterId] : []);
      if (item.targetType === "USER") parties.add(item.targetId);
      if (item.relatedPathId) {
        const path = pathById.get(item.relatedPathId);
        if (!path) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
        parties.add(path.participantAId);
        parties.add(path.participantBId);
      }
      if (item.relatedOrderId) {
        const order = orderById.get(item.relatedOrderId);
        if (!order) throw new NotFoundException("MATERIAL_ORDER_NOT_FOUND");
        parties.add(order.buyerId);
        parties.add(order.sellerId);
      }
      assertIndependentCaseActor(actorId, [...parties]);
    }
  }
  private async audit(
    tx: TransactionContext,
    actorId: string,
    targetId: string,
    action: string,
    reason: string,
    after: object,
  ) {
    await this.auditLog.append(tx, {
      actorId,
      action,
      targetType: "REPORT_SUPPORT",
      targetId,
      reason,
      after: { decision: JSON.stringify(after) },
    });
  }
  queue(
    actor: Principal,
    query: {
      limit: number;
      cursor?: string;
      severity?: string;
      status?: string;
      handlerId?: string;
    },
  ) {
    let after: string | undefined;
    if (query.cursor) {
      try {
        const row = z
          .strictObject({ id: z.uuid(), scope: z.string() })
          .parse(
            JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8")),
          );
        if (
          row.scope !==
          JSON.stringify([
            actor.userId,
            query.severity ?? null,
            query.status ?? null,
            query.handlerId ?? null,
          ])
        )
          throw new Error("scope");
        after = row.id;
      } catch {
        throw new BadRequestException("INVALID_REPORT_QUEUE_CURSOR");
      }
    }
    return this.transactions.run(async (tx) => {
      await this.staff(tx, actor, "report:moderate");
      const rows = await tx.reportCase.findMany({
        where: {
          id: after ? { gt: after } : undefined,
          severity: query.severity,
          handlerId: query.handlerId,
          status: query.status
            ? (query.status as "OPEN")
            : { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
        },
        select: {
          id: true,
          reasonCode: true,
          status: true,
          handlerId: true,
          createdAt: true,
          severity: true,
          version: true,
          incidentId: true,
          relatedPathId: true,
          relatedSessionId: true,
          targetType: true,
          targetId: true,
        },
        orderBy: { id: "asc" },
        take: query.limit + 1,
      });
      const data = rows.slice(0, query.limit),
        last = data.at(-1);
      return {
        data,
        pagination: {
          limit: query.limit,
          hasMore: rows.length > query.limit,
          nextCursor:
            rows.length > query.limit && last
              ? Buffer.from(
                  JSON.stringify({
                    id: last.id,
                    scope: JSON.stringify([
                      actor.userId,
                      query.severity ?? null,
                      query.status ?? null,
                      query.handlerId ?? null,
                    ]),
                  }),
                ).toString("base64url")
              : null,
        },
      };
    });
  }
  incident(actor: Principal, id: string) {
    return this.transactions.run(async (tx) => {
      await this.staff(tx, actor, "report:group");
      const incident = await tx.reportIncident.findUnique({
        where: { id },
        include: {
          cases: {
            select: {
              id: true,
              status: true,
              version: true,
              severity: true,
              reporterId: true,
              targetType: true,
              targetId: true,
              relatedPathId: true,
              relatedOrderId: true,
            },
          },
        },
      });
      if (!incident) throw new NotFoundException("INCIDENT_NOT_FOUND");
      await this.assertIndependentCases(tx, actor.userId, incident.cases);
      return {
        ...incident,
        cases: incident.cases.map(({ id, status, version, severity }) => ({
          id,
          status,
          version,
          severity,
        })),
      };
    });
  }
  classifyIncident(
    actor: Principal,
    id: string,
    input: { severity: string; expectedVersion: number; reason: string },
  ) {
    return this.transactions.run(async (tx) => {
      await this.staff(tx, actor, "report:classify");
      await tx.$queryRawUnsafe(
        "SELECT id FROM report_incidents WHERE id=$1::uuid FOR UPDATE",
        id,
      );
      const incident = await tx.reportIncident.findUnique({
        where: { id },
        include: { cases: true },
      });
      if (!incident) throw new NotFoundException("INCIDENT_NOT_FOUND");
      if (incident.handlerId !== actor.userId)
        throw new ForbiddenException("INCIDENT_NOT_ASSIGNED");
      if (
        incident.version !== input.expectedVersion ||
        incident.status !== "OPEN"
      )
        throw new ConflictException("STALE_INCIDENT_VERSION");
      await this.assertIndependentCases(tx, actor.userId, incident.cases);
      await tx.reportCase.updateMany({
        where: { incidentId: id },
        data: { severity: input.severity, version: { increment: 1 } },
      });
      const result = await tx.reportIncident.update({
        where: { id },
        data: { severity: input.severity, version: { increment: 1 } },
      });
      await this.audit(
        tx,
        actor.userId,
        id,
        "REPORT_INCIDENT_CLASSIFY",
        input.reason,
        { severity: result.severity, version: result.version },
      );
      return result;
    });
  }
  createIncident(
    actor: Principal,
    input: { caseIds: string[]; reason: string; severity: string },
  ) {
    if (
      input.caseIds.length < 2 ||
      input.caseIds.length > 100 ||
      new Set(input.caseIds).size !== input.caseIds.length
    )
      throw new BadRequestException("INVALID_INCIDENT_CASES");
    return this.transactions.run(async (tx) => {
      await this.staff(tx, actor, "report:group");
      const ids = [...input.caseIds].sort((a, b) => a.localeCompare(b));
      const initial = await tx.reportCase.findMany({
        where: { id: { in: ids } },
      });
      if (initial.length !== ids.length)
        throw new NotFoundException("REPORT_CASE_NOT_FOUND");
      assertSameIncident(initial);
      // Path before cases matches lifecycle writer order; all cases share this Path.
      if (initial[0]!.relatedPathId)
        await lockLearningPath(tx, initial[0]!.relatedPathId!);
      await tx.$queryRawUnsafe(
        "SELECT case_id FROM report_cases WHERE case_id = ANY($1::uuid[]) ORDER BY case_id FOR UPDATE",
        ids,
      );
      const cases = await tx.reportCase.findMany({
        where: { id: { in: ids } },
        orderBy: { id: "asc" },
      });
      assertSameIncident(cases);
      await this.assertIndependentCases(tx, actor.userId, cases);
      for (const item of cases) {
        if (
          !OPEN_REPORT_STATUSES.includes(item.status) ||
          item.incidentId ||
          (item.handlerId && item.handlerId !== actor.userId)
        )
          throw new ConflictException("REPORT_CASE_NOT_GROUPABLE");
      }
      const first = cases[0]!;
      const incident = await tx.reportIncident.create({
        data: {
          id: randomUUID(),
          targetType: first.targetType,
          targetId: first.targetId,
          reason: input.reason.trim(),
          severity: input.severity,
          handlerId: actor.userId,
        },
      });
      await tx.reportCase.updateMany({
        where: { id: { in: ids } },
        data: {
          incidentId: incident.id,
          severity: input.severity,
          status: "UNDER_REVIEW",
          handlerId: actor.userId,
          version: { increment: 1 },
        },
      });
      await this.audit(
        tx,
        actor.userId,
        incident.id,
        "REPORT_INCIDENT_CREATE",
        input.reason,
        { caseIds: ids, severity: input.severity },
      );
      return { ...incident, caseIds: ids };
    });
  }
  classify(
    actor: Principal,
    caseId: string,
    input: { severity: string; expectedVersion: number; reason: string },
  ) {
    return this.transactions.run(async (tx) => {
      await this.staff(tx, actor, "report:classify");
      await tx.$queryRawUnsafe(
        "SELECT case_id FROM report_cases WHERE case_id=$1::uuid FOR UPDATE",
        caseId,
      );
      const { item, parties } = await this.parties(tx, caseId);
      assertIndependentCaseActor(actor.userId, parties);
      if (item.version !== input.expectedVersion)
        throw new ConflictException("STALE_REPORT_CASE_VERSION");
      if (!OPEN_REPORT_STATUSES.includes(item.status))
        throw new ConflictException("REPORT_CASE_CLOSED");
      if (item.handlerId && item.handlerId !== actor.userId)
        throw new ForbiddenException("REPORT_CASE_NOT_ASSIGNED_TO_CALLER");
      if (item.incidentId)
        throw new ConflictException("CLASSIFY_INCIDENT_REQUIRED");
      const row = await tx.reportCase.update({
        where: { id: caseId },
        data: { severity: input.severity, version: { increment: 1 } },
      });
      await this.audit(
        tx,
        actor.userId,
        caseId,
        "REPORT_CLASSIFY",
        input.reason,
        { severity: row.severity, version: row.version },
      );
      return { id: row.id, severity: row.severity, version: row.version };
    });
  }
  decide(
    actor: Principal,
    incidentId: string,
    input: {
      action: "resolve" | "reject";
      expectedVersion: number;
      note: string;
      noShowRuling?: NonNullable<ReportCaseActionDto["noShowRuling"]>;
      makeupUserId?: string;
    },
  ) {
    return this.transactions.run(async (tx) => {
      const live = await this.staff(tx, actor, "report:group");
      await tx.$queryRawUnsafe(
        "SELECT id FROM report_incidents WHERE id=$1::uuid FOR UPDATE",
        incidentId,
      );
      const incident = await tx.reportIncident.findUnique({
        where: { id: incidentId },
      });
      if (!incident) throw new NotFoundException("INCIDENT_NOT_FOUND");
      if (incident.handlerId !== actor.userId)
        throw new ForbiddenException("INCIDENT_NOT_ASSIGNED");
      if (
        incident.version !== input.expectedVersion ||
        incident.status !== "OPEN"
      )
        throw new ConflictException("STALE_INCIDENT_VERSION");
      const cases = await tx.reportCase.findMany({
        where: { incidentId },
        orderBy: { id: "asc" },
      });
      assertSameIncident(cases);
      await this.assertIndependentCases(tx, actor.userId, cases);
      for (const item of cases) {
        if (
          !OPEN_REPORT_STATUSES.includes(item.status) ||
          item.handlerId !== actor.userId
        )
          throw new ConflictException("INCIDENT_CASE_CHANGED");
      }
      // Each transition reads the preceding case's writes before releasing shared
      // Path/Session blockers. Parallel transitions could reconcile the Path too soon.
      for (let index = 0; index < cases.length; index++) {
        const item = cases[index]!;
        await this.reports.updateCaseInTransaction(
          // NOSONAR: dependent owner transitions on one transaction, not independent I/O.
          tx,
          { ...actor, permissions: [...live.permissions] },
          item.id,
          input.action,
          {
            note: input.note,
            ...(index === 0
              ? {
                  noShowRuling: input.noShowRuling,
                  makeupUserId: input.makeupUserId,
                }
              : {}),
          },
          true,
        );
      }
      const updated = await tx.reportIncident.update({
        where: { id: incidentId },
        data: {
          status: input.action === "resolve" ? "RESOLVED" : "REJECTED",
          version: { increment: 1 },
          resolvedAt: new Date(),
        },
      });
      await this.audit(
        tx,
        actor.userId,
        incidentId,
        "REPORT_INCIDENT_DECIDE",
        input.note,
        { status: updated.status, caseIds: cases.map((item) => item.id) },
      );
      return updated;
    });
  }
}
