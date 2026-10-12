import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { FileAttachmentService } from "../../infrastructure/storage/file-attachment.service";
import { FileStorageService } from "../../infrastructure/storage/file-storage.service";
import { TransactionRunner } from "../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../infrastructure/database/transaction-context";
import type { Principal } from "../auth/application/services/sessions.service";
import { AuditWriter } from "../audit/application/audit-writer";
import type { AuditActor } from "../audit/application/audit.types";
import type {
  Actor,
  RoleCode,
} from "../../shared/authorization/authorization.types";
import type { PermissionCode } from "../../shared/authorization/permission.catalog";
import type { CreateSessionReportDto } from "./reports.dto";

async function lockPath(tx: TransactionContext, pathId: string) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT path_id AS id FROM learning_paths WHERE path_id = ${pathId}::uuid FOR UPDATE`;
  if (!rows.length) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly storage: FileStorageService,
    private readonly attachments: FileAttachmentService,
    private readonly audit: AuditWriter,
  ) {}

  private storageActor(principal: Principal): Actor {
    const roles = principal.roles.filter(
      (role): role is RoleCode =>
        role === "USER" || role === "STAFF" || role === "ADMIN",
    );
    return {
      userId: principal.userId,
      accountStatus: "ACTIVE",
      roles,
      permissions: new Set(principal.permissions as PermissionCode[]),
      blockedPermissions: new Set(),
    };
  }

  upload(
    principal: Principal,
    input: {
      name: string;
      claimedMime: string;
      body: Readable;
      correlationId: string;
    },
  ) {
    return this.storage.upload({
      actor: this.storageActor(principal),
      purpose: "REPORT",
      name: input.name,
      claimedMime: input.claimedMime,
      body: input.body,
      context: { correlationId: input.correlationId },
    });
  }

  fileStatus(principal: Principal, fileId: string) {
    return this.attachments.status(principal, fileId);
  }

  async staffEvidenceDownload(actor: Principal, evidenceId: string) {
    this.requireStaff(actor);
    const row = await this.transactions.run(async (tx) => {
      const evidence = await tx.reportEvidence.findUnique({
        where: { id: evidenceId },
        select: { caseId: true, storageKey: true },
      });
      if (!evidence) throw new NotFoundException("REPORT_EVIDENCE_NOT_FOUND");
      const stored = await tx.storedFile.findFirst({
        where: {
          objectKey: evidence.storageKey,
          resourceType: "REPORT_EVIDENCE",
          resourceId: evidence.caseId,
          purpose: "REPORT",
        },
        select: { id: true },
      });
      if (!stored) throw new NotFoundException("REPORT_EVIDENCE_NOT_FOUND");
      const roles = actor.roles.filter(
        (role): role is RoleCode =>
          role === "USER" || role === "STAFF" || role === "ADMIN",
      );
      await this.audit.append(tx, {
        actor: { kind: "HUMAN", userId: actor.userId, roles },
        action: "REPORT_EVIDENCE_READ",
        target: { type: "REPORT_EVIDENCE", id: evidenceId },
        after: { caseId: evidence.caseId, access: "READ" },
        reason: "Staff accessed report evidence",
        context: { requestId: randomUUID(), correlationId: randomUUID() },
      });
      return { fileId: stored.id, caseId: evidence.caseId };
    });
    return this.storage.issueDownload(
      {
        actor: this.storageActor(actor),
        fileId: row.fileId,
        resource: { type: "REPORT_EVIDENCE", id: evidenceId },
      },
      {
        assertRead: () => {
          this.requireStaff(actor);
          return Promise.resolve();
        },
      },
    );
  }

  createSessionReport(
    actor: Principal,
    sessionId: string,
    input: CreateSessionReportDto,
  ) {
    if (new Set(input.evidenceFileIds).size !== input.evidenceFileIds.length) {
      throw new ConflictException("DUPLICATE_REPORT_EVIDENCE");
    }
    return this.transactions.run(async (tx) => {
      const session = await tx.session.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException("SESSION_NOT_FOUND");
      await lockPath(tx, session.pathId);
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: session.pathId },
      });
      if (
        actor.userId !== session.teacherId &&
        actor.userId !== session.learnerId
      ) {
        throw new ForbiddenException("SESSION_ACCESS_DENIED");
      }
      if (session.status === "CANCELLED")
        throw new ConflictException("SESSION_NOT_REPORTABLE");
      const activeReport = await tx.reportCase.findFirst({
        where: {
          reporterId: actor.userId,
          relatedSessionId: sessionId,
          status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
        },
        select: { id: true },
      });
      if (activeReport)
        throw new ConflictException("ACTIVE_SESSION_REPORT_EXISTS");
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (!(clock?.now instanceof Date))
        throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
      if (clock.now >= this.disputeDeadline(session.endAt))
        throw new ConflictException("DISPUTE_WINDOW_CLOSED");
      const caseId = randomUUID();
      const blocksSettlement = path.settledAt === null;
      await tx.reportCase.create({
        data: {
          id: caseId,
          reporterId: actor.userId,
          targetType: "SESSION",
          targetId: sessionId,
          relatedSessionId: sessionId,
          relatedPathId: path.id,
          reasonCode: input.reasonCode.trim(),
          description: input.description.trim(),
          status: "OPEN",
          blocksSettlement,
        },
      });
      for (const fileId of input.evidenceFileIds) {
        const file = await this.attachments.attachReady(tx, actor, fileId, {
          type: "REPORT_EVIDENCE",
          id: caseId,
          purpose: "REPORT",
        });
        await tx.reportEvidence.create({
          data: {
            id: randomUUID(),
            caseId,
            mimeType: file.mime,
            storageKey: file.key,
            fileSizeBytes: BigInt(file.size),
            uploadedAt: file.uploadedAt,
          },
        });
      }
      if (blocksSettlement) {
        await tx.learningPath.update({
          where: { id: path.id },
          data: { status: "DISPUTED" },
        });
      }
      await tx.outboxEvent.create({
        data: {
          aggregateType: "REPORT_CASE",
          aggregateId: caseId,
          version: 1,
          type: "report.session.opened",
          payload: {
            caseId,
            pathId: path.id,
            sessionId,
            reporterId: actor.userId,
            blocksSettlement,
          },
          dedupeKey: `report-session-opened:${caseId}`,
          correlationId: randomUUID(),
        },
      });
      return { id: caseId, sessionId, status: "OPEN", blocksSettlement };
    });
  }

  listMine(actor: Principal) {
    return this.transactions.run((tx) =>
      tx.reportCase.findMany({
        where: { reporterId: actor.userId },
        include: {
          reportEvidenceCaseIdRecords: {
            select: {
              id: true,
              mimeType: true,
              fileSizeBytes: true,
              uploadedAt: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
  }

  staffQueue(actor: Principal) {
    this.requireStaff(actor);
    return this.transactions.run((tx) =>
      tx.reportCase.findMany({
        where: { status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] } },
        include: {
          reportEvidenceCaseIdRecords: {
            select: {
              id: true,
              mimeType: true,
              fileSizeBytes: true,
              uploadedAt: true,
            },
          },
        },
        orderBy: [{ id: "asc" }],
        take: 100,
      }),
    );
  }

  async assertPathSettlementAllowed(
    tx: TransactionContext,
    pathId: string,
    now: Date,
  ) {
    const blockingCase = await tx.reportCase.findFirst({
      where: {
        relatedPathId: pathId,
        blocksSettlement: true,
        status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
      },
      select: { id: true },
    });
    if (blockingCase)
      throw new ConflictException("SETTLEMENT_BLOCKED_BY_DISPUTE");
    const sessions = await tx.session.findMany({
      where: { pathId },
      select: { endAt: true },
    });
    if (!sessions.length) throw new ConflictException("PATH_SESSIONS_MISSING");
    const latestEnd = new Date(
      Math.max(...sessions.map(({ endAt }) => endAt.getTime())),
    );
    const deadline = this.disputeDeadline(latestEnd);
    if (now < deadline) throw new ConflictException("DISPUTE_WINDOW_OPEN");
  }

  updateCase(
    actor: Principal,
    caseId: string,
    action: "claim" | "need-more-info" | "resolve" | "reject",
    note?: string,
  ) {
    this.requireStaff(actor);
    return this.transactions.run(async (tx) => {
      const item = await tx.reportCase.findUnique({ where: { id: caseId } });
      if (!item) throw new NotFoundException("REPORT_CASE_NOT_FOUND");
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (!(clock?.now instanceof Date))
        throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
      const claimCase = async () => {
        if (item.status === "UNDER_REVIEW" && item.handlerId === actor.userId)
          return item;
        if (item.status !== "OPEN")
          throw new ConflictException("REPORT_CASE_NOT_CLAIMABLE");
        const updated = await tx.reportCase.update({
          where: { id: caseId },
          data: { status: "UNDER_REVIEW", handlerId: actor.userId },
        });
        await this.auditCaseAction(
          tx,
          actor,
          item,
          updated.status,
          "Claimed report case",
        );
        await this.emitCaseUpdated(
          tx,
          updated.id,
          updated.reporterId,
          updated.status,
        );
        return updated;
      };
      if (action === "claim") return claimCase();
      if (item.handlerId !== actor.userId)
        throw new ForbiddenException("REPORT_CASE_NOT_ASSIGNED_TO_CALLER");
      if (action === "need-more-info") {
        const updated = await tx.reportCase.update({
          where: { id: caseId },
          data: {
            status: "NEED_MORE_INFO",
            resolutionNote: note?.trim() || null,
          },
        });
        await this.auditCaseAction(
          tx,
          actor,
          item,
          updated.status,
          note?.trim() || "Requested more information",
        );
        await this.emitCaseUpdated(
          tx,
          updated.id,
          updated.reporterId,
          updated.status,
        );
        return updated;
      }
      if (!note?.trim())
        throw new ConflictException("RESOLUTION_NOTE_REQUIRED");
      const resolved = await tx.reportCase.update({
        where: { id: caseId },
        data: {
          status: action === "resolve" ? "RESOLVED" : "REJECTED",
          resolutionCode:
            action === "resolve" ? "STAFF_RESOLVED" : "STAFF_REJECTED",
          resolutionNote: note.trim(),
          resolvedByUserId: actor.userId,
          resolvedAt: clock.now,
          blocksSettlement: false,
        },
      });
      await this.auditCaseAction(tx, actor, item, resolved.status, note.trim());
      await this.emitCaseUpdated(
        tx,
        resolved.id,
        resolved.reporterId,
        resolved.status,
      );
      const reconcilePathAfterReport = async () => {
        if (item.relatedPathId) {
          const unresolvedBlocks = await tx.reportCase.count({
            where: {
              relatedPathId: item.relatedPathId,
              id: { not: caseId },
              blocksSettlement: true,
              status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
            },
          });
          if (unresolvedBlocks === 0) {
            const path = await tx.learningPath.findUnique({
              where: { id: item.relatedPathId },
            });
            if (path?.status === "DISPUTED") {
              const incomplete = await tx.session.count({
                where: { pathId: path.id, status: { not: "COMPLETED" } },
              });
              const unsettledStatus = incomplete === 0 ? "ACTIVE" : "SCHEDULED";
              await tx.learningPath.update({
                where: { id: path.id },
                data: {
                  status: path.settledAt ? "COMPLETED" : unsettledStatus,
                },
              });
            }
          }
        }
      };
      await reconcilePathAfterReport();
      return resolved;
    });
  }

  private requireStaff(actor: Principal) {
    if (
      !actor.permissions.includes("report:moderate") ||
      (!actor.roles.includes("STAFF") && !actor.roles.includes("ADMIN"))
    ) {
      throw new ForbiddenException("STAFF_ACCESS_REQUIRED");
    }
  }

  private disputeDeadline(sessionEndAt: Date): Date {
    return new Date(sessionEndAt.getTime() + 48 * 60 * 60 * 1_000);
  }

  private async auditCaseAction(
    tx: TransactionContext,
    actor: Principal,
    before: { id: string; status: string },
    status: string,
    reason: string,
  ) {
    const validRoles = actor.roles.filter(
      (role): role is RoleCode =>
        role === "USER" || role === "STAFF" || role === "ADMIN",
    );
    const auditActor: AuditActor = {
      kind: "HUMAN",
      userId: actor.userId,
      roles: validRoles,
    };
    await this.audit.append(tx, {
      actor: auditActor,
      action: "REPORT_CASE_UPDATE",
      target: { type: "REPORT_CASE", id: before.id },
      before: { status: before.status },
      after: { status },
      reason,
      context: { requestId: randomUUID(), correlationId: randomUUID() },
    });
  }

  private async emitCaseUpdated(
    tx: TransactionContext,
    caseId: string,
    reporterId: string,
    status: string,
  ) {
    await tx.outboxEvent.create({
      data: {
        aggregateType: "REPORT_CASE",
        aggregateId: caseId,
        version: 1,
        type: "report.case.updated",
        payload: { caseId, reporterId, status },
        dedupeKey: `report-case-updated:${caseId}:${status}`,
        correlationId: randomUUID(),
      },
    });
  }
}
