import type { ReportCase } from "../../../../generated/prisma/client";
import {
  BadRequestException,
  ServiceUnavailableException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import {
  applyNoShowRuling,
  currentOutcome,
  releaseDisputedOutcome,
} from "../../../learning-sessions/application/services/session-transitions";
import { lockLearningPath as lockPath } from "../../../learning-paths/application/services/learning-path-lock";
import { hoursAfter } from "../../../learning-sessions/domain/attendance.policy";
import { lockedSession } from "../../../learning-sessions/application/services/session-tx";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { FileAttachmentService } from "../../../../infrastructure/storage/file-attachment.service";
import { FileStorageService } from "../../../../infrastructure/storage/file-storage.service";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { AuditActor } from "../../../audit/application/contracts/audit.types";
import type { RoleCode } from "../../../../shared/authorization/authorization.types";
import { storageActor } from "../../../../shared/authorization/principal-actor";
import type { PermissionCode } from "../../../../shared/authorization/permission.catalog";
import { CreditAdjustmentPort } from "../../../credit/application/ports/credit.ports";
import { ReputationService } from "../../../reputation/application/services/reputation.service";
import type {
  CreateSessionReportDto,
  ReportCaseActionDto,
} from "../../presentation/http/reports.dto";
import { SessionChangesService } from "../../../learning-sessions/application/services/session-changes.service";
import { assertIndependentCaseActor } from "../../domain/report-support.policy";
import { evidenceMetadata, partyEvidenceWhere } from "./report-evidence-view";
import {
  sessionReportBlockReason,
  sessionReporting,
} from "../../domain/session-report.policy";

type ReportCaseAction = "claim" | "need-more-info" | "resolve" | "reject";

/** Signed Credit text, already format-checked by the DTO, in hundredths. */
function signedCreditUnits(value: string): bigint {
  const negative = value.startsWith("-");
  const [whole = "0", fraction = ""] = (
    negative ? value.slice(1) : value
  ).split(".");
  const units = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -units : units;
}

const evidenceSummary = (viewerId?: string) =>
  ({
    reportEvidenceCaseIdRecords: {
      ...(viewerId ? { where: partyEvidenceWhere(viewerId, viewerId) } : {}),
      select: evidenceMetadata,
    },
  }) as const;

/** BigInt is not JSON-serializable; sizes are returned as strings like skill evidence. */
function withEvidenceSizeText<
  T extends { reportEvidenceCaseIdRecords: { fileSizeBytes: bigint }[] },
>(cases: T[]) {
  return cases.map((item) => ({
    ...item,
    evidenceCount: item.reportEvidenceCaseIdRecords.length,
    reportEvidenceCaseIdRecords: item.reportEvidenceCaseIdRecords.map(
      (evidence) => ({
        ...evidence,
        fileSizeBytes: evidence.fileSizeBytes.toString(),
      }),
    ),
  }));
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly storage: FileStorageService,
    private readonly attachments: FileAttachmentService,
    private readonly audit: AuditWriter,
    private readonly reputation: ReputationService,
    private readonly creditAdjustments: CreditAdjustmentPort,
    private readonly configuration: SystemConfigurationService,
    private readonly sessionChanges: SessionChangesService,
  ) {}

  /** Advisory preflight for authorized session reads; POST rechecks under its locks. */
  async reportingForSessions(
    tx: TransactionContext,
    actorId: string,
    sessions: {
      id: string;
      startAt: Date;
      endAt: Date;
      teacherId: string;
      learnerId: string;
      status: string;
    }[],
  ) {
    if (!sessions.length)
      return new Map<string, ReturnType<typeof sessionReporting>>();
    const ids = sessions.map((s) => s.id);
    const [outcomes, reports, clocks] = await Promise.all([
      tx.sessionAttendanceOutcome.findMany({
        where: { sessionId: { in: ids } },
        select: { sessionId: true, occurrenceStartAt: true, finalizesAt: true },
      }),
      tx.reportCase.findMany({
        where: {
          reporterId: actorId,
          relatedSessionId: { in: ids },
          status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
        },
        select: { relatedSessionId: true },
      }),
      tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS now`,
    ]);
    const now = clocks[0]?.now;
    if (!(now instanceof Date))
      throw new ServiceUnavailableException("DATABASE_TIME_UNAVAILABLE");
    const current = (session: (typeof sessions)[number]) =>
      outcomes.find(
        (o) =>
          o.sessionId === session.id &&
          +o.occurrenceStartAt === +session.startAt,
      );
    let hours: number | null = null;
    if (sessions.some((s) => !current(s))) {
      try {
        hours = (await this.attendancePolicy(tx)).disputeWindowHours;
      } catch (error) {
        if (!(error instanceof ServiceUnavailableException)) throw error;
      }
    }
    return new Map(
      sessions.map((session) => {
        let reportBy = current(session)?.finalizesAt ?? null;
        if (!reportBy && hours !== null)
          reportBy = hoursAfter(session.endAt, hours);
        return [
          session.id,
          sessionReporting({
            session,
            actorId,
            now,
            reportBy,
            activeReport: reports.some(
              (r) => r.relatedSessionId === session.id,
            ),
          }),
        ];
      }),
    );
  }

  /** Case opened by the Session lifecycle itself; holds settlement like a user report. */
  async openSystemSessionCase(
    tx: TransactionContext,
    input: {
      sessionId: string;
      pathId: string;
      reasonCode:
        "MAKEUP_EXPIRED" | "ATTENDANCE_UNVERIFIABLE" | "MAKEUP_LIMIT_REACHED";
      description: string;
    },
  ): Promise<string> {
    const open = await tx.reportCase.findFirst({
      where: {
        relatedSessionId: input.sessionId,
        reasonCode: input.reasonCode,
        status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
      },
      select: { id: true },
    });
    if (open) return open.id;
    const path = await tx.learningPath.findUniqueOrThrow({
      where: { id: input.pathId },
    });
    const caseId = randomUUID();
    const blocksSettlement =
      path.settledAt === null && path.status !== "CANCELLED";
    await tx.reportCase.create({
      data: {
        id: caseId,
        reporterId: null,
        targetType: "SESSION",
        targetId: input.sessionId,
        relatedSessionId: input.sessionId,
        relatedPathId: path.id,
        reasonCode: input.reasonCode,
        description: input.description,
        status: "OPEN",
        blocksSettlement,
      },
    });
    if (blocksSettlement)
      await tx.learningPath.update({
        where: { id: path.id },
        data: {
          status: "DISPUTED",
          participantASettlementApprovedAt: null,
          participantBSettlementApprovedAt: null,
        },
      });
    await this.audit.append(tx, {
      actor: { kind: "SYSTEM", name: "session-lifecycle" },
      action: "REPORT_CASE_UPDATE",
      target: { type: "REPORT_CASE", id: caseId },
      after: { status: "OPEN" },
      reason: input.description,
      context: { requestId: randomUUID(), correlationId: randomUUID() },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "REPORT_CASE",
        aggregateId: caseId,
        version: 1,
        type: "report.session.opened",
        payload: {
          caseId,
          pathId: path.id,
          sessionId: input.sessionId,
          reporterId: null,
          blocksSettlement,
        },
        dedupeKey: `report-session-opened:${caseId}`,
        correlationId: randomUUID(),
      },
    });
    return caseId;
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
      actor: storageActor(principal),
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
        select: { caseId: true, storageKey: true, storedFileId: true },
      });
      if (!evidence) throw new NotFoundException("REPORT_EVIDENCE_NOT_FOUND");
      {
        const report = await tx.reportCase.findUniqueOrThrow({
          where: { id: evidence.caseId },
          select: { handlerId: true },
        });
        if (report.handlerId !== actor.userId)
          throw new ForbiddenException("REPORT_CASE_NOT_ASSIGNED_TO_CALLER");
      }
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
        actor: storageActor(actor),
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
      const session = await lockedSession(tx, sessionId);
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: session.pathId },
      });
      const accessReason = sessionReportBlockReason(
        session,
        actor.userId,
        false,
      );
      if (accessReason === "SESSION_ACCESS_DENIED") {
        throw new ForbiddenException("SESSION_ACCESS_DENIED");
      }
      if (accessReason) throw new ConflictException(accessReason);
      const activeReport = await tx.reportCase.findFirst({
        where: {
          reporterId: actor.userId,
          relatedSessionId: sessionId,
          status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
        },
        select: { id: true },
      });
      const activeReason = sessionReportBlockReason(
        session,
        actor.userId,
        Boolean(activeReport),
      );
      if (activeReason) throw new ConflictException(activeReason);
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (!(clock?.now instanceof Date))
        throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
      const outcome = await currentOutcome(tx, session);
      const disputeBy =
        outcome?.finalizesAt ?? (await this.disputeDeadline(tx, session.endAt));
      const reporting = sessionReporting({
        session,
        actorId: actor.userId,
        activeReport: false,
        reportBy: disputeBy,
        now: clock.now,
      });
      if (reporting.blockedReason)
        throw new ConflictException(reporting.blockedReason);
      const caseId = randomUUID();
      const blocksSettlement =
        path.settledAt === null && path.status !== "CANCELLED";
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
      if (session.status === "NO_SHOW")
        await tx.sessionAttendanceOutcome.updateMany({
          where: { sessionId, status: "PROVISIONAL" },
          data: { status: "DISPUTED" },
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
            partyId: actor.userId,
            storedFileId: fileId,
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
          data: {
            status: "DISPUTED",
            participantASettlementApprovedAt: null,
            participantBSettlementApprovedAt: null,
          },
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
    return this.transactions.run(async (tx) =>
      withEvidenceSizeText(
        await tx.reportCase.findMany({
          where: { reporterId: actor.userId },
          include: evidenceSummary(actor.userId),
          orderBy: [
            { createdAt: { sort: "desc", nulls: "last" } },
            { id: "desc" },
          ],
        }),
      ),
    );
  }

  mineDetail(actor: Principal, caseId: string) {
    return this.transactions.run(async (tx) => {
      const item = await tx.reportCase.findFirst({
        where: { id: caseId, reporterId: actor.userId },
        include: evidenceSummary(actor.userId),
      });
      if (!item) throw new NotFoundException("REPORT_CASE_NOT_FOUND");
      return withEvidenceSizeText([item])[0];
    });
  }

  staffQueue(actor: Principal) {
    this.requireStaff(actor);
    return this.transactions.run(async (tx) =>
      withEvidenceSizeText(
        await tx.reportCase.findMany({
          where: {
            status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
          },
          include: evidenceSummary(),
          orderBy: [{ id: "asc" }],
          take: 100,
        }),
      ),
    );
  }

  /** True while an unresolved case on the path holds its final settlement. */
  async hasBlockingDispute(
    tx: TransactionContext,
    learningPathId: string,
  ): Promise<boolean> {
    const blockingCase = await tx.reportCase.findFirst({
      where: {
        relatedPathId: learningPathId,
        blocksSettlement: true,
        status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
      },
      select: { id: true },
    });
    return blockingCase !== null;
  }

  async assertPathSettlementAllowed(
    tx: TransactionContext,
    pathId: string,
    now: Date,
  ) {
    if (await this.hasBlockingDispute(tx, pathId))
      throw new ConflictException("SETTLEMENT_BLOCKED_BY_DISPUTE");
    const path = await tx.learningPath.findUniqueOrThrow({
      where: { id: pathId },
    });
    const deadline = await this.pathSettlementDeadline(tx, pathId);
    if (
      path.participantASettlementApprovedAt &&
      path.participantBSettlementApprovedAt
    )
      return;
    if (now < deadline) throw new ConflictException("DISPUTE_WINDOW_OPEN");
  }

  async pathSettlementDeadline(tx: TransactionContext, pathId: string) {
    const sessions = await tx.session.findMany({
      where: { pathId },
      select: { id: true, startAt: true, endAt: true },
    });
    if (!sessions.length) throw new ConflictException("PATH_SESSIONS_MISSING");
    const outcomes = await tx.sessionAttendanceOutcome.findMany({
      where: { sessionId: { in: sessions.map(({ id }) => id) } },
      select: { sessionId: true, occurrenceStartAt: true, finalizesAt: true },
    });
    const deadlines = await Promise.all(
      sessions.map(async (session) => {
        const outcome = outcomes.find(
          (row) =>
            row.sessionId === session.id &&
            +row.occurrenceStartAt === +session.startAt,
        );
        return outcome?.finalizesAt ?? this.disputeDeadline(tx, session.endAt);
      }),
    );
    return new Date(Math.max(...deadlines.map((at) => +at)));
  }

  updateCase(
    actor: Principal,
    caseId: string,
    action: ReportCaseAction,
    input: ReportCaseActionDto = {},
  ) {
    return this.transactions.run((tx) =>
      this.updateCaseInTransaction(tx, actor, caseId, action, input),
    );
  }

  /** Reports owner transition shared by single-case and atomic incident decisions. */
  async updateCaseInTransaction(
    tx: TransactionContext,
    actor: Principal,
    caseId: string,
    action: ReportCaseAction,
    input: ReportCaseActionDto = {},
    incidentDecision = false,
  ) {
    this.requireStaff(actor);
    const note = input.note;
    this.assertResolutionAllowed(actor, action, input);
    const initial = await tx.reportCase.findUnique({ where: { id: caseId } });
    if (!initial) throw new NotFoundException("REPORT_CASE_NOT_FOUND");
    // Case effects share the same Path -> Session locks as lifecycle writers.
    if (initial.relatedSessionId)
      await lockedSession(tx, initial.relatedSessionId);
    else if (initial.relatedPathId) await lockPath(tx, initial.relatedPathId);
    const item = await tx.reportCase.findUniqueOrThrow({
      where: { id: caseId },
    });
    await this.assertIndependentReviewer(tx, actor, item);
    if (this.isCaseReplay(item, action, incidentDecision)) return item;
    const [clock] = await tx.$queryRaw<
      { now: Date }[]
    >`SELECT CURRENT_TIMESTAMP AS now`;
    if (!(clock?.now instanceof Date))
      throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
    if (action === "claim") return this.claimCase(tx, actor, item);
    if (item.handlerId !== actor.userId)
      throw new ForbiddenException("REPORT_CASE_NOT_ASSIGNED_TO_CALLER");
    if (action === "need-more-info") {
      const updated = await tx.reportCase.update({
        where: { id: caseId },
        data: {
          status: "NEED_MORE_INFO",
          version: { increment: 1 },
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
    if (!note?.trim()) throw new ConflictException("RESOLUTION_NOTE_REQUIRED");
    await this.settleSessionRuling(tx, item, action, input, clock.now);
    const resolved = await tx.reportCase.update({
      where: { id: caseId },
      data: {
        status: action === "resolve" ? "RESOLVED" : "REJECTED",
        version: { increment: 1 },
        resolutionCode:
          action === "resolve" ? "STAFF_RESOLVED" : "STAFF_REJECTED",
        resolutionNote: note.trim(),
        resolvedByUserId: actor.userId,
        resolvedAt: clock.now,
        blocksSettlement: false,
      },
    });
    await this.auditCaseAction(tx, actor, item, resolved.status, note.trim());
    if (action === "resolve") {
      await this.applyResolution(tx, actor, item, input, clock.now);
    }

    await this.emitCaseUpdated(
      tx,
      resolved.id,
      resolved.reporterId,
      resolved.status,
      item.relatedPathId,
    );
    await this.reconcilePathAfterReport(tx, item);
    return resolved;
  }

  /** Grouped cases require an incident decision; closed cases only accept exact replays. */
  private isCaseReplay(
    item: ReportCase,
    action: ReportCaseAction,
    incidentDecision: boolean,
  ) {
    if (
      item.incidentId &&
      !incidentDecision &&
      (action === "resolve" || action === "reject")
    )
      throw new ConflictException("INCIDENT_DECISION_REQUIRED");
    if (item.status !== "RESOLVED" && item.status !== "REJECTED") return false;
    if (
      (action === "resolve" && item.status === "RESOLVED") ||
      (action === "reject" && item.status === "REJECTED")
    )
      return true;
    throw new ConflictException("REPORT_CASE_CLOSED");
  }
  /** Validate all participants before allowing any moderation transition. */
  private async assertIndependentReviewer(
    tx: TransactionContext,
    actor: Principal,
    item: ReportCase,
  ) {
    const parties = new Set<string>(item.reporterId ? [item.reporterId] : []);
    if (item.targetType === "USER") parties.add(item.targetId);
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
    assertIndependentCaseActor(actor.userId, [...parties]);
  }
  /** Claim an open case idempotently with its audit and notification in the same transaction. */
  private async claimCase(
    tx: TransactionContext,
    actor: Principal,
    item: ReportCase,
  ) {
    if (item.status === "UNDER_REVIEW" && item.handlerId === actor.userId)
      return item;
    if (item.status !== "OPEN")
      throw new ConflictException("REPORT_CASE_NOT_CLAIMABLE");
    const updated = await tx.reportCase.update({
      where: { id: item.id },
      data: {
        status: "UNDER_REVIEW",
        handlerId: actor.userId,
        version: { increment: 1 },
      },
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
  }
  /** Reconcile only after all other settlement-blocking cases have been released. */
  private async reconcilePathAfterReport(
    tx: TransactionContext,
    item: ReportCase,
  ) {
    if (item.relatedPathId) {
      const unresolvedBlocks = await tx.reportCase.count({
        where: {
          relatedPathId: item.relatedPathId,
          id: { not: item.id },
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
  }

  private async settleSessionRuling(
    tx: TransactionContext,
    item: {
      id: string;
      relatedSessionId: string | null;
      reporterId: string | null;
    },
    action: "resolve" | "reject",
    input: ReportCaseActionDto,
    now: Date,
  ) {
    if (
      input.makeupUserId &&
      (action !== "resolve" || input.noShowRuling !== "EXCUSE")
    )
      throw new BadRequestException("MAKEUP_USER_REQUIRES_EXCUSE_RULING");
    if (!item.relatedSessionId) {
      if (input.noShowRuling || input.cancellationMakeupRuling)
        throw new ConflictException("NO_SHOW_RULING_NOT_APPLICABLE");
      return;
    }
    if (input.noShowRuling && input.cancellationMakeupRuling)
      throw new BadRequestException("ONE_SESSION_RULING_REQUIRED");
    if (action === "resolve" && input.cancellationMakeupRuling) {
      await this.sessionChanges.ruleCancelledMakeup(
        tx,
        item.relatedSessionId,
        input.cancellationMakeupRuling,
        now,
      );
      return;
    }
    const session = await tx.session.findUniqueOrThrow({
      where: { id: item.relatedSessionId },
      select: { id: true, startAt: true, status: true },
    });
    if (
      input.violations?.some((violation) => violation.reasonCode === "NO_SHOW")
    )
      throw new BadRequestException("NO_SHOW_REQUIRES_ATTENDANCE_RULING");
    if (action === "resolve" && input.noShowRuling) {
      await applyNoShowRuling(tx, this.reputation, {
        sessionId: item.relatedSessionId,
        ruling: input.noShowRuling,
        now,
        makeupUserId: input.makeupUserId ?? item.reporterId ?? undefined,
      });
      return;
    }
    // Only a ruling can move a Session the lifecycle handed to Staff.
    if (session.status === "DISPUTED")
      throw new ConflictException("NO_SHOW_RULING_REQUIRED");
    await releaseDisputedOutcome(tx, item.relatedSessionId, item.id);
  }

  private requireStaff(actor: Principal) {
    if (
      !actor.permissions.includes("report:moderate") ||
      (!actor.roles.includes("STAFF") && !actor.roles.includes("ADMIN"))
    ) {
      throw new ForbiddenException("STAFF_ACCESS_REQUIRED");
    }
  }

  staffCaseDetail(actor: Principal, caseId: string) {
    this.requireStaff(actor);
    return this.transactions.run(async (tx) => {
      const item = await tx.reportCase.findUnique({
        where: { id: caseId },
        include: evidenceSummary(),
      });
      if (!item) throw new NotFoundException("REPORT_CASE_NOT_FOUND");
      const session = item.relatedSessionId
        ? await tx.session.findUnique({
            where: { id: item.relatedSessionId },
            select: {
              id: true,
              planId: true,
              teacherId: true,
              learnerId: true,
              startAt: true,
              endAt: true,
              status: true,
              teacherConfirmationStatus: true,
              learnerConfirmationStatus: true,
            },
          })
        : null;
      const path = item.relatedPathId
        ? await tx.learningPath.findUnique({
            where: { id: item.relatedPathId },
            select: {
              id: true,
              status: true,
              participantAId: true,
              participantBId: true,
              lockedVersion: true,
              settledAt: true,
            },
          })
        : null;
      const outcome = session
        ? await tx.sessionAttendanceOutcome.findFirst({
            where: {
              sessionId: session.id,
              occurrenceStartAt: session.startAt,
            },
          })
        : null;
      const [withSizes] = withEvidenceSizeText([item]);
      return {
        ...withSizes,
        session,
        path,
        // Attendance evidence lets Staff reconcile a no-show report without uploads.
        attendanceOutcome: outcome && {
          ...outcome,
          teacherSeconds: outcome.teacherSeconds.toString(),
          learnerSeconds: outcome.learnerSeconds.toString(),
        },
      };
    });
  }

  /** Outcome options exist only on resolve, and each credit/lock power needs its permission. */
  private assertResolutionAllowed(
    actor: Principal,
    action: string,
    input: ReportCaseActionDto,
  ) {
    const requested = {
      violations: (input.violations?.length ?? 0) > 0,
      restriction: input.restriction !== undefined,
      creditAdjustments: (input.creditAdjustments?.length ?? 0) > 0,
      reversals: (input.reversals?.length ?? 0) > 0,
      noShowRuling: input.noShowRuling !== undefined,
      cancellationMakeupRuling: input.cancellationMakeupRuling !== undefined,
    };
    if (action !== "resolve" && Object.values(requested).some(Boolean)) {
      throw new BadRequestException("RESOLUTION_OPTIONS_REQUIRE_RESOLVE");
    }
    const required: [boolean, PermissionCode][] = [
      [requested.restriction, "dispute:override"],
      [requested.creditAdjustments, "credit:adjust"],
      [requested.reversals, "credit:reverse:settlement"],
    ];
    if (
      required.some(
        ([wanted, permission]) =>
          wanted && !actor.permissions.includes(permission),
      )
    ) {
      throw new ForbiddenException("RESOLUTION_PERMISSION_REQUIRED");
    }
  }

  /**
   * Applies the decided outcome inside the resolve transaction: confirmed
   * violations, an adjudicated lock, and new compensating credit entries that
   * reference the case. Any failure rolls the whole resolution back.
   */
  private async applyResolution(
    tx: TransactionContext,
    actor: Principal,
    item: {
      id: string;
      relatedPathId: string | null;
      relatedOrderId?: string | null;
    },
    input: ReportCaseActionDto,
    now: Date,
  ) {
    const violations = input.violations ?? [];
    const adjustments = input.creditAdjustments ?? [];
    const reversals = input.reversals ?? [];
    const targets = [
      ...violations,
      ...adjustments,
      ...(input.restriction ? [input.restriction] : []),
    ];
    if (targets.length === 0 && reversals.length === 0) return;
    const path = item.relatedPathId
      ? await tx.learningPath.findUnique({ where: { id: item.relatedPathId } })
      : null;
    const order = item.relatedOrderId
      ? await tx.materialOrder.findUnique({
          where: { id: item.relatedOrderId },
        })
      : null;
    if (!path && !order)
      throw new ConflictException("REPORT_CASE_FINANCIAL_TARGET_REQUIRED");
    const participants = new Set([
      ...(path ? [path.participantAId, path.participantBId] : []),
      ...(order ? [order.buyerId, order.sellerId] : []),
    ]);
    if (targets.some(({ userId }) => !participants.has(userId))) {
      throw new BadRequestException("RESOLUTION_TARGET_NOT_PARTICIPANT");
    }
    const reason = input.note!.trim();
    const auditActor = this.auditActor(actor);
    const context = { requestId: randomUUID(), correlationId: randomUUID() };
    for (const violation of violations) {
      await this.reputation.applyViolation(tx, {
        ...violation,
        sourceId: item.id,
        eventKey: `report-case:${item.id}:${violation.reasonCode}:${violation.userId}`,
        now,
      });
    }
    if (input.restriction) {
      await this.reputation.applyAdjudicatedRestriction(tx, {
        ...input.restriction,
        caseId: item.id,
        actor: auditActor,
        reason,
        now,
      });
    }
    for (const [index, adjustment] of adjustments.entries()) {
      const amount = signedCreditUnits(adjustment.amount);
      if (amount === 0n) throw new BadRequestException("INVALID_CREDIT_AMOUNT");
      const { operationId } = await this.creditAdjustments.adjust(tx, {
        userId: adjustment.userId,
        amount,
        referenceType: "REPORT_CASE",
        referenceId: item.id,
        actorId: actor.userId,
        reason,
        idempotencyKey: `report-case:${item.id}:adjust:${index}`,
      });
      await this.audit.append(tx, {
        actor: auditActor,
        action: "CREDIT_ADJUST",
        target: { type: "USER", id: adjustment.userId },
        after: { amount: amount.toString(), operationId, referenceId: item.id },
        reason,
        context,
      });
    }
    for (const reversal of reversals) {
      if (!path) throw new ConflictException("REPORT_CASE_PATH_REQUIRED");
      const operation = await tx.creditOperation.findUnique({
        where: { id: reversal.operationId },
        select: { referenceId: true },
      });
      if (operation?.referenceId !== path.id) {
        throw new BadRequestException("REVERSAL_OPERATION_NOT_IN_PATH");
      }
      const { operationId } = await this.creditAdjustments.reverse(tx, {
        operationId: reversal.operationId,
        referenceType: "REPORT_CASE",
        referenceId: item.id,
        sourceReferenceId: path.id,
        actorId: actor.userId,
        reason,
        idempotencyKey: `report-case:${item.id}:reverse:${reversal.operationId}`,
      });
      await this.audit.append(tx, {
        actor: auditActor,
        action: "CREDIT_REVERSE",
        target: { type: "CREDIT_OPERATION", id: reversal.operationId },
        after: { operationId, referenceId: item.id },
        reason,
        context,
      });
    }
  }

  private auditActor(actor: Principal): AuditActor {
    return {
      kind: "HUMAN",
      userId: actor.userId,
      roles: actor.roles.filter(
        (role): role is RoleCode =>
          role === "USER" || role === "STAFF" || role === "ADMIN",
      ),
    };
  }

  private async attendancePolicy(tx: TransactionContext) {
    const { values } = await this.configuration.getSnapshot(
      ["session.attendancePolicy"],
      tx,
    );
    const policy = values["session.attendancePolicy"];
    if (!policy)
      throw new ServiceUnavailableException(
        "Configuration not ready: session.attendancePolicy",
      );
    return policy;
  }

  private async disputeDeadline(tx: TransactionContext, sessionEndAt: Date) {
    return hoursAfter(
      sessionEndAt,
      (await this.attendancePolicy(tx)).disputeWindowHours,
    );
  }

  private async auditCaseAction(
    tx: TransactionContext,
    actor: Principal,
    before: { id: string; status: string },
    status: string,
    reason: string,
  ) {
    await this.audit.append(tx, {
      actor: this.auditActor(actor),
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
    reporterId: string | null,
    status: string,
    pathId?: string | null,
  ) {
    await tx.outboxEvent.create({
      data: {
        aggregateType: "REPORT_CASE",
        aggregateId: caseId,
        version: 1,
        type: "report.case.updated",
        payload: { caseId, reporterId, status, ...(pathId ? { pathId } : {}) },
        dedupeKey: `report-case-updated:${caseId}:${status}`,
        correlationId: randomUUID(),
      },
    });
  }
}
