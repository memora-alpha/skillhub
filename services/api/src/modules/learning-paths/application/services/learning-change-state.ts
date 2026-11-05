import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  LearningChangeRequest,
  LearningPath,
  Prisma,
  Session,
} from "../../../../generated/prisma/client";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { fingerprintCommand } from "../../../../infrastructure/idempotency/idempotency.service";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import { validateReason } from "../../../audit/domain/reason.policy";

export const OPEN_CHANGE_STATUSES = ["PENDING", "ACCEPTED", "STAFF_REVIEW"];
export type ChangeKind = "SESSION_CANCELLATION" | "PATH_TERMINATION";
type ChangeStatus =
  | "PENDING"
  | "ACCEPTED"
  | "STAFF_REVIEW"
  | "REJECTED"
  | "WITHDRAWN"
  | "EXPIRED"
  | "APPLIED";

export function assertPathParticipant(
  actor: Principal,
  path: Pick<LearningPath, "participantAId" | "participantBId">,
) {
  if (![path.participantAId, path.participantBId].includes(actor.userId))
    throw new ForbiddenException("LEARNING_PATH_ACCESS_DENIED");
}

export function assertChangeablePath(path: LearningPath) {
  if (
    !path.lockedVersion ||
    path.settledAt ||
    !["SCHEDULED", "ACTIVE", "DISPUTED"].includes(path.status)
  )
    throw new ConflictException("LEARNING_PATH_CANNOT_BE_CHANGED");
}

/** Read contract: callers already hold the Path lock before financial execution. */
export function pendingTermination(
  tx: TransactionContext,
  pathId: string,
  now: Date,
) {
  return tx.learningChangeRequest.findFirst({
    where: {
      pathId,
      kind: "PATH_TERMINATION",
      status: { in: OPEN_CHANGE_STATUSES },
      expiresAt: { gt: now },
    },
    select: { id: true },
  });
}

export async function changeBlockedByDispute(
  tx: TransactionContext,
  pathId: string,
) {
  return (
    (await tx.reportCase.count({
      where: {
        relatedPathId: pathId,
        blocksSettlement: true,
        status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
      },
    })) > 0
  );
}

export function changeView(
  row: LearningChangeRequest,
  blockedByDispute: boolean,
  policyReady: boolean,
) {
  return {
    id: row.id,
    pathId: row.pathId,
    sessionId: row.sessionId,
    kind: row.kind,
    status: row.status,
    version: row.version,
    requesterId: row.requesterId,
    reason: row.reason,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    occurrenceStartAt: row.occurrenceStartAt,
    responderId: row.responderId,
    respondedAt: row.respondedAt,
    accepted: row.accepted,
    responseNote: row.responseNote,
    closedAt: row.closedAt,
    resolvedByUserId: row.resolvedByUserId,
    operationId: row.operationId,
    resolution: row.resolution,
    blockedByDispute:
      OPEN_CHANGE_STATUSES.includes(row.status) && blockedByDispute,
    awaitingPolicy:
      row.kind === "PATH_TERMINATION" &&
      OPEN_CHANGE_STATUSES.includes(row.status) &&
      !policyReady,
  };
}

@Injectable()
export class LearningChangeState {
  constructor(
    private readonly audit: AuditWriter,
    private readonly configuration: SystemConfigurationService,
  ) {}

  async policy(tx: TransactionContext) {
    const { values } = await this.configuration.getSnapshot(
      ["learningPath.changeRequests"],
      tx,
    );
    return values["learningPath.changeRequests"];
  }

  async create(
    tx: TransactionContext,
    actor: Principal,
    path: LearningPath,
    input: {
      kind: ChangeKind;
      key: string;
      reason: string;
      session?: Session;
      expectedStartAt?: string;
    },
    now: Date,
  ) {
    assertPathParticipant(actor, path);
    if (
      typeof input.key !== "string" ||
      !/^[\x21-\x7e]{1,128}$/.test(input.key)
    )
      throw new BadRequestException("INVALID_IDEMPOTENCY_KEY");
    const reason = validateReason(input.reason, { min: 3, max: 1000 });
    // Occurrence is checked separately on first execution; replay must survive a later reschedule.
    const instructionDigest = fingerprintCommand({
      kind: input.kind,
      sessionId: input.session?.id ?? null,
      expectedStartAt: input.expectedStartAt ?? null,
      reason,
    });
    const existing = await tx.learningChangeRequest.findUnique({
      where: {
        pathId_requesterId_idempotencyKey: {
          pathId: path.id,
          requesterId: actor.userId,
          idempotencyKey: input.key,
        },
      },
    });
    if (existing) {
      if (existing.instructionDigest !== instructionDigest)
        throw new ConflictException("CHANGE_REQUEST_KEY_CONFLICT");
      return existing;
    }
    assertChangeablePath(path);
    await this.expire(tx, path.id, now);
    const other = await tx.learningChangeRequest.findFirst({
      where: {
        pathId: path.id,
        kind: input.kind,
        sessionId: input.session?.id ?? null,
        status: { in: OPEN_CHANGE_STATUSES },
      },
    });
    if (other) throw new ConflictException("CHANGE_REQUEST_ALREADY_PENDING");
    const policy = await this.policy(tx);
    let expiresAt = new Date(+now + policy.requestWindowHours * 3_600_000);
    let policySnapshot: Prisma.InputJsonValue = policy;
    if (input.session) {
      if (
        !input.expectedStartAt ||
        +new Date(input.expectedStartAt) !== +input.session.startAt
      )
        throw new ConflictException("STALE_SESSION_OCCURRENCE");
      if (
        input.session.pathId !== path.id ||
        !["CONFIRMED", "READY"].includes(input.session.status) ||
        now >= input.session.startAt
      )
        throw new ConflictException("SESSION_CANNOT_BE_CANCELLED");
      expiresAt = new Date(Math.min(+expiresAt, +input.session.startAt));
      const { values } = await this.configuration.getSnapshot(
        ["session.attendancePolicy"],
        tx,
      );
      policySnapshot = {
        ...policy,
        makeupWindowDays: values["session.attendancePolicy"].makeupWindowDays,
      };
    }
    const row = await tx.learningChangeRequest.create({
      data: {
        pathId: path.id,
        sessionId: input.session?.id ?? null,
        kind: input.kind,
        requesterId: actor.userId,
        reason,
        idempotencyKey: input.key,
        instructionDigest,
        occurrenceStartAt: input.session?.startAt ?? null,
        policySnapshot,
        expiresAt,
      },
    });
    await this.record(tx, row, actor, reason);
    return row;
  }

  async get(
    tx: TransactionContext,
    pathId: string,
    id: string,
    kind: ChangeKind,
  ) {
    const row = await tx.learningChangeRequest.findUnique({ where: { id } });
    if (!row || row.pathId !== pathId || row.kind !== kind)
      throw new NotFoundException("CHANGE_REQUEST_NOT_FOUND");
    return row;
  }

  async respond(
    tx: TransactionContext,
    actor: Principal,
    row: LearningChangeRequest,
    input: { expectedVersion: number; accept: boolean; note?: string },
    now: Date,
  ) {
    if (row.requesterId === actor.userId)
      throw new ForbiddenException("PARTNER_DECISION_REQUIRED");
    const note = input.note?.trim() || null;
    if (
      row.respondedAt &&
      row.responderId === actor.userId &&
      row.accepted === input.accept &&
      row.responseNote === note
    )
      return row;
    this.assertOpen(row, input.expectedVersion, now);
    if (row.status !== "PENDING")
      throw new ConflictException("CHANGE_REQUEST_ALREADY_DECIDED");
    let status: ChangeStatus = "ACCEPTED";
    if (!input.accept)
      status = row.kind === "PATH_TERMINATION" ? "STAFF_REVIEW" : "REJECTED";
    return this.update(
      tx,
      row,
      status,
      actor,
      note ?? "Partner responded to learning change",
      now,
      {
        responderId: actor.userId,
        respondedAt: now,
        accepted: input.accept,
        responseNote: note,
      },
    );
  }

  async withdraw(
    tx: TransactionContext,
    actor: Principal,
    row: LearningChangeRequest,
    expectedVersion: number,
    now: Date,
  ) {
    if (row.requesterId !== actor.userId)
      throw new ForbiddenException("CHANGE_REQUEST_OWNER_REQUIRED");
    if (row.status === "WITHDRAWN") return row;
    this.assertOpen(row, expectedVersion, now);
    return this.update(
      tx,
      row,
      "WITHDRAWN",
      actor,
      "Requester withdrew learning change",
      now,
    );
  }

  assertOpen(row: LearningChangeRequest, expectedVersion: number, now: Date) {
    if (row.version !== expectedVersion)
      throw new ConflictException("STALE_CHANGE_REQUEST_VERSION");
    if (!OPEN_CHANGE_STATUSES.includes(row.status))
      throw new ConflictException("CHANGE_REQUEST_CLOSED");
    if (now >= row.expiresAt)
      throw new ConflictException("CHANGE_REQUEST_EXPIRED");
  }

  async update(
    tx: TransactionContext,
    row: LearningChangeRequest,
    status: ChangeStatus,
    actor: Principal | null,
    reason: string,
    now: Date,
    extra: Prisma.LearningChangeRequestUncheckedUpdateInput = {},
  ) {
    const updated = await tx.learningChangeRequest.update({
      where: { id: row.id },
      data: {
        ...extra,
        status,
        version: { increment: 1 },
        ...(OPEN_CHANGE_STATUSES.includes(status) ? {} : { closedAt: now }),
      },
    });
    await this.record(tx, updated, actor, reason, row);
    return updated;
  }

  async expire(tx: TransactionContext, pathId: string, now: Date) {
    const due = await tx.learningChangeRequest.findMany({
      where: {
        pathId,
        status: { in: OPEN_CHANGE_STATUSES },
        expiresAt: { lte: now },
      },
      orderBy: { id: "asc" },
    });
    // Sequential: each request's state, audit and outbox are committed as one owner transition.
    for (const row of due)
      await this.update(
        tx,
        row,
        "EXPIRED",
        null,
        "Learning change request expired",
        now,
      );
  }

  private async record(
    tx: TransactionContext,
    row: LearningChangeRequest,
    actor: Principal | null,
    reason: string,
    before?: LearningChangeRequest,
  ) {
    const snapshot = (item: LearningChangeRequest) => ({
      pathId: item.pathId,
      sessionId: item.sessionId,
      kind: item.kind,
      status: item.status,
      version: item.version,
      operationId: item.operationId,
    });
    await this.audit.append(tx, {
      actor: actor
        ? {
            kind: "HUMAN",
            userId: actor.userId,
            roles: actor.roles.filter(
              (role): role is "USER" | "STAFF" | "ADMIN" =>
                ["USER", "STAFF", "ADMIN"].includes(role),
            ),
          }
        : { kind: "SYSTEM", name: "learning-change-recovery" },
      action: "LEARNING_CHANGE_UPDATE",
      target: { type: "LEARNING_CHANGE", id: row.id },
      before: before ? snapshot(before) : undefined,
      after: snapshot(row),
      reason,
      context: { requestId: randomUUID(), correlationId: randomUUID() },
    });
    await tx.outboxEvent.create({
      data: {
        eventId: randomUUID(),
        correlationId: randomUUID(),
        aggregateType: "LEARNING_PATH",
        aggregateId: row.pathId,
        type: "learning-path.change.updated",
        version: 1,
        dedupeKey: `learning-change:${row.id}:v${row.version}`,
        payload: {
          pathId: row.pathId,
          changeRequestId: row.id,
          status: row.status,
        },
      },
    });
  }
}
