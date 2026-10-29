import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { lockLearningPath as lockPath } from "../../../learning-paths/application/services/learning-path-lock";
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

/** Signed Credit text, already format-checked by the DTO, in hundredths. */
function signedCreditUnits(value: string): bigint {
  const negative = value.startsWith("-");
  const [whole = "0", fraction = ""] = (
    negative ? value.slice(1) : value
  ).split(".");
  const units = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -units : units;
}

const evidenceSummary = {
  reportEvidenceCaseIdRecords: {
    select: { id: true, mimeType: true, fileSizeBytes: true, uploadedAt: true },
  },
} as const;

/** BigInt is not JSON-serializable; sizes are returned as strings like skill evidence. */
function withEvidenceSizeText<
  T extends { reportEvidenceCaseIdRecords: { fileSizeBytes: bigint }[] },
>(cases: T[]) {
  return cases.map((item) => ({
    ...item,
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
  ) {}

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
    return this.transactions.run(async (tx) =>
      withEvidenceSizeText(
        await tx.reportCase.findMany({
          where: { reporterId: actor.userId },
          include: evidenceSummary,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
      ),
    );
  }

  staffQueue(actor: Principal) {
    this.requireStaff(actor);
    return this.transactions.run(async (tx) =>
      withEvidenceSizeText(
        await tx.reportCase.findMany({
          where: {
            status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
          },
          include: evidenceSummary,
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
    input: ReportCaseActionDto = {},
  ) {
    this.requireStaff(actor);
    const note = input.note;
    this.assertResolutionAllowed(actor, action, input);
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

  staffCaseDetail(actor: Principal, caseId: string) {
    this.requireStaff(actor);
    return this.transactions.run(async (tx) => {
      const item = await tx.reportCase.findUnique({
        where: { id: caseId },
        include: evidenceSummary,
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
      const [withSizes] = withEvidenceSizeText([item]);
      return { ...withSizes, session, path };
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
    reporterId: string,
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
