import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import {
  byCodeUnit,
  fingerprintCommand,
} from "../../../../infrastructure/idempotency/idempotency.service";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { Principal } from "../../../auth/application/services/sessions.service";
import type {
  LearningChangeRequest,
  LearningPath,
  Prisma,
} from "../../../../generated/prisma/client";
import {
  LearningChangeState,
  assertChangeablePath,
  assertPathParticipant,
  changeBlockedByDispute,
  changeView,
  OPEN_CHANGE_STATUSES,
} from "./learning-change-state";
import {
  lockLearningPath,
  lockLearningPathLifecycle,
} from "./learning-path-lock";
import { databaseNow } from "../../../learning-sessions/application/services/session-tx";
import { SessionChangesService } from "../../../learning-sessions/application/services/session-changes.service";
import {
  PathTerminationPort,
  type TerminationQuote,
} from "../../../credit/application/ports/path-termination.port";
import { formatCredit, parseCredit } from "../../../credit/domain/money";
import { validateReason } from "../../../audit/domain/reason.policy";
import { LearningRequestLifecycleService } from "../../../learning-requests/application/services/learning-request-lifecycle.service";
import { LearningRequestPathReader } from "./learning-request-path.reader";

export type TerminationDecision = {
  expectedVersion: number;
  expectedExecutionDigest: string;
  policyReference?: string;
  reason: string;
  compensationReason?: string;
  allocations?: {
    allocationId: string;
    refund: string;
    counterpartyPayment: string;
    platformFee: string;
  }[];
};

function requireReviewer(actor: Principal, execute = false) {
  const role = actor.roles.includes("ADMIN") || actor.roles.includes("STAFF");
  const required = execute
    ? ["report:moderate", "learning-path:terminate"]
    : ["report:moderate"];
  if (
    !role ||
    required.some((permission) => !actor.permissions.includes(permission))
  )
    throw new ForbiddenException("TERMINATION_REVIEW_PERMISSION_REQUIRED");
}

@Injectable()
export class PathTerminationService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly changes: LearningChangeState,
    private readonly sessions: SessionChangesService,
    private readonly credit: PathTerminationPort,
    private readonly requests: LearningRequestLifecycleService,
    private readonly requestPaths: LearningRequestPathReader,
  ) {}

  request(actor: Principal, pathId: string, key: string, reason: string) {
    return this.transactions.run(async (tx) => {
      const { path, now } = await this.context(tx, actor, pathId);
      const row = await this.changes.create(
        tx,
        actor,
        path,
        { kind: "PATH_TERMINATION", key, reason },
        now,
      );
      return this.view(tx, row);
    });
  }

  list(actor: Principal, pathId: string) {
    return this.transactions.run(async (tx) => {
      const { now } = await this.context(tx, actor, pathId);
      await this.changes.expire(tx, pathId, now);
      const rows = await tx.learningChangeRequest.findMany({
        where: { pathId, kind: "PATH_TERMINATION" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      });
      const blocked = await changeBlockedByDispute(tx, pathId);
      const ready = !!(await this.changes.policy(tx))
        .terminationPolicyReference;
      return rows.map((row) => changeView(row, blocked, ready));
    });
  }

  respond(
    actor: Principal,
    pathId: string,
    requestId: string,
    input: { expectedVersion: number; accept: boolean; note?: string },
  ) {
    return this.transactions.run(async (tx) => {
      await lockLearningPathLifecycle(
        tx,
        pathId,
        this.requestPaths,
        this.requests,
        actor,
      );
      const { path, now } = await this.context(tx, actor, pathId);
      const row = await this.changes.get(
        tx,
        pathId,
        requestId,
        "PATH_TERMINATION",
      );
      const decided = await this.changes.respond(tx, actor, row, input, now);
      if (decided.status !== "ACCEPTED") return this.view(tx, decided);
      const approved = decided.approvedAt
        ? decided
        : await this.approve(
            tx,
            actor,
            path,
            decided,
            {
              reason: "Both participants agreed to terminate",
              digest: fingerprintCommand({
                requestId,
                responderId: actor.userId,
                expectedVersion: input.expectedVersion,
                accept: input.accept,
                note: input.note?.trim() ?? null,
              }),
              quote: (await this.executionSnapshot(tx, path, now)).quote,
            },
            now,
          );
      return this.view(
        tx,
        await this.completeApproved(tx, actor, path, approved, now),
      );
    });
  }

  withdraw(
    actor: Principal,
    pathId: string,
    requestId: string,
    expectedVersion: number,
  ) {
    return this.transactions.run(async (tx) => {
      const { now } = await this.context(tx, actor, pathId);
      const row = await this.changes.get(
        tx,
        pathId,
        requestId,
        "PATH_TERMINATION",
      );
      return this.view(
        tx,
        await this.changes.withdraw(tx, actor, row, expectedVersion, now),
      );
    });
  }

  escalate(
    actor: Principal,
    pathId: string,
    requestId: string,
    expectedVersion: number,
    reason: string,
  ) {
    return this.transactions.run(async (tx) => {
      const { now } = await this.context(tx, actor, pathId);
      const row = await this.changes.get(
        tx,
        pathId,
        requestId,
        "PATH_TERMINATION",
      );
      this.changes.assertOpen(row, expectedVersion, now);
      if (row.approvedAt)
        throw new ConflictException("TERMINATION_ALREADY_APPROVED");
      return this.view(
        tx,
        await this.changes.update(
          tx,
          row,
          "STAFF_REVIEW",
          actor,
          validateReason(reason, { min: 3, max: 1000 }),
          now,
        ),
      );
    });
  }

  review(actor: Principal, pathId: string, requestId: string) {
    requireReviewer(actor);
    return this.transactions.run(async (tx) => {
      await lockLearningPath(tx, pathId);
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: pathId },
      });
      const now = await databaseNow(tx);
      await this.changes.expire(tx, pathId, now);
      const row = await this.changes.get(
        tx,
        pathId,
        requestId,
        "PATH_TERMINATION",
      );
      return {
        ...(await this.view(tx, row)),
        execution: await this.executionSnapshot(tx, path, now),
      };
    });
  }

  quote(actor: Principal, pathId: string) {
    return this.transactions.run(async (tx) => {
      const { path, now } = await this.context(tx, actor, pathId);
      if (!path.lockedVersion) {
        const held = await tx.heldCreditAllocation.count({
          where: { pathId, remainingHeld: { gt: 0n } },
        });
        if (held)
          throw new ConflictException("TERMINATION_ALLOCATION_MISMATCH");
        return {
          pathId,
          lockedVersion: null,
          executionDigest: null,
          policyReference: null,
          policy: null,
          status: "NOT_LOCKED",
          reasonCodes: ["CREDIT_NOT_HELD"],
          totalSessions: 0,
          completedSessions: 0,
          unresolvedSessionIds: [],
          directions: [],
          allocations: [],
        };
      }
      assertChangeablePath(path);
      const execution = await this.executionSnapshot(tx, path, now);
      const reasonCodes = new Set(execution.quote.reasonCodes);
      if (!execution.policyReference)
        reasonCodes.add("TERMINATION_POLICY_NOT_APPROVED");
      if (await changeBlockedByDispute(tx, pathId))
        reasonCodes.add("TERMINATION_BLOCKED_BY_DISPUTE");
      return {
        pathId,
        lockedVersion: path.lockedVersion,
        executionDigest: execution.digest,
        policyReference: execution.policyReference,
        ...execution.quote,
        status: reasonCodes.size ? "BLOCKED" : "READY",
        reasonCodes: [...reasonCodes],
      };
    });
  }

  reject(
    actor: Principal,
    pathId: string,
    requestId: string,
    expectedVersion: number,
    reason: string,
  ) {
    requireReviewer(actor);
    return this.transactions.run(async (tx) => {
      await lockLearningPath(tx, pathId);
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: pathId },
      });
      this.assertIndependentReviewer(actor, path);
      const row = await this.changes.get(
        tx,
        pathId,
        requestId,
        "PATH_TERMINATION",
      );
      const now = await databaseNow(tx);
      if (row.status === "REJECTED") return this.view(tx, row);
      if (row.approvedAt)
        throw new ConflictException("TERMINATION_ALREADY_APPROVED");
      this.changes.assertOpen(row, expectedVersion, now);
      return this.view(
        tx,
        await this.changes.update(
          tx,
          row,
          "REJECTED",
          actor,
          validateReason(reason, { min: 3, max: 1000 }),
          now,
          {
            resolvedByUserId: actor.userId,
            resolution: { outcome: "REJECTED", reason: reason.trim() },
          },
        ),
      );
    });
  }

  execute(
    actor: Principal,
    pathId: string,
    requestId: string,
    input: TerminationDecision,
  ) {
    requireReviewer(actor, true);
    const reason = validateReason(input.reason, { min: 3, max: 1000 });
    const commandDigest = fingerprintCommand({
      expectedVersion: input.expectedVersion,
      expectedExecutionDigest: input.expectedExecutionDigest,
      policyReference: input.policyReference ?? null,
      compensationReason: input.compensationReason?.trim() ?? null,
      reason,
      allocations: input.allocations
        ? [...input.allocations].sort((a, b) =>
            byCodeUnit(a.allocationId, b.allocationId),
          )
        : null,
    });
    return this.transactions.run(async (tx) => {
      await lockLearningPathLifecycle(
        tx,
        pathId,
        this.requestPaths,
        this.requests,
      );
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: pathId },
      });
      this.assertIndependentReviewer(actor, path);
      const row = await this.changes.get(
        tx,
        pathId,
        requestId,
        "PATH_TERMINATION",
      );
      const recorded = row.resolution as { approvalDigest?: string } | null;
      if (row.approvedAt) {
        if (
          row.resolvedByUserId !== actor.userId ||
          recorded?.approvalDigest !== commandDigest
        )
          throw new ConflictException("TERMINATION_DECISION_CONFLICT");
        if (row.status === "APPLIED") return this.view(tx, row);
        return this.view(
          tx,
          await this.completeApproved(
            tx,
            actor,
            path,
            row,
            await databaseNow(tx),
          ),
        );
      }
      const now = await databaseNow(tx);
      this.changes.assertOpen(row, input.expectedVersion, now);
      assertChangeablePath(path);
      if (!["ACCEPTED", "STAFF_REVIEW"].includes(row.status))
        throw new ConflictException("TERMINATION_DECISION_NOT_READY");
      const execution = await this.executionSnapshot(tx, path, now);
      if (execution.digest !== input.expectedExecutionDigest)
        throw new ConflictException("STALE_TERMINATION_EXECUTION");
      if (
        input.policyReference &&
        input.policyReference !== execution.policyReference
      )
        throw new ConflictException("TERMINATION_POLICY_NOT_APPROVED");
      if (input.allocations) {
        const expected = execution.quote.allocations;
        if (
          input.allocations.length !== expected.length ||
          new Set(input.allocations.map((item) => item.allocationId)).size !==
            expected.length ||
          input.allocations.some((item) => {
            const calculated = expected.find(
              (value) => value.allocationId === item.allocationId,
            );
            return (
              !calculated ||
              parseCredit(item.refund) !== parseCredit(calculated.refund) ||
              parseCredit(item.counterpartyPayment) !==
                parseCredit(calculated.counterpartyPayment) ||
              parseCredit(item.platformFee) !==
                parseCredit(calculated.platformFee)
            );
          })
        )
          throw new ConflictException("TERMINATION_FORMULA_MISMATCH");
      }
      const approved = await this.approve(
        tx,
        actor,
        path,
        row,
        { reason, digest: commandDigest, quote: execution.quote },
        now,
      );
      return this.view(
        tx,
        await this.completeApproved(tx, actor, path, approved, now),
      );
    });
  }

  private async approve(
    tx: TransactionContext,
    actor: Principal,
    path: LearningPath,
    row: LearningChangeRequest,
    approval: { reason: string; digest: string; quote: TerminationQuote },
    now: Date,
  ) {
    const { reason, digest, quote } = approval;
    if (quote.reasonCodes.includes("TERMINATION_USE_FINAL_SETTLEMENT"))
      throw new ConflictException("TERMINATION_USE_FINAL_SETTLEMENT");
    const cutoff = path.terminationApprovedAt ?? now;
    await tx.learningPath.update({
      where: { id: path.id },
      data: { terminationApprovedAt: cutoff },
    });
    path.terminationApprovedAt = cutoff;
    await this.sessions.cancelFutureObligations(
      tx,
      path.id,
      actor.userId,
      reason,
      cutoff,
    );
    return this.changes.update(tx, row, "ACCEPTED", actor, reason, now, {
      approvedAt: cutoff,
      resolvedByUserId: actor.userId,
      resolution: {
        approvalDigest: digest,
        reason,
        approvedAt: cutoff.toISOString(),
      },
    });
  }

  recoverApproved(pathId: string, requestId: string) {
    return this.transactions.run(async (tx) => {
      await lockLearningPathLifecycle(
        tx,
        pathId,
        this.requestPaths,
        this.requests,
      );
      const row = await this.changes.get(
        tx,
        pathId,
        requestId,
        "PATH_TERMINATION",
      );
      if (!row.approvedAt || row.status !== "ACCEPTED") return row;
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: pathId },
      });
      return this.completeApproved(tx, null, path, row, await databaseNow(tx));
    });
  }

  private async completeApproved(
    tx: TransactionContext,
    actor: Principal | null,
    path: LearningPath,
    row: LearningChangeRequest,
    now: Date,
  ) {
    const execution = await this.executionSnapshot(tx, path, now);
    if (
      !execution.policyReference ||
      execution.quote.status !== "READY" ||
      (await changeBlockedByDispute(tx, path.id))
    )
      return row;
    const source = await this.requestPaths.readPathSource(tx, path.id);
    const request = source.requestId
      ? await this.requests.lockForPath(tx, source.requestId)
      : null;
    if (request) {
      const committed = await this.requestPaths.readCommittedPathIds(
        tx,
        request.id,
      );
      if (
        request.status !== "MATCHED" ||
        committed.length !== 1 ||
        committed[0] !== path.id
      )
        throw new ConflictException("REQUEST_LIFECYCLE_INCONSISTENT");
    }
    const agreement = await tx.learningPathVersion.findUniqueOrThrow({
      where: {
        pathId_versionNo: { pathId: path.id, versionNo: path.lockedVersion! },
      },
    });
    const resolution = row.resolution as Prisma.JsonObject;
    const reason = String(resolution.reason);
    const cancelledSessionIds = await this.sessions.cancelRemaining(
      tx,
      path.id,
      row.resolvedByUserId ?? row.requesterId,
      reason,
      now,
    );
    const allocations = execution.quote.allocations.map((item) => ({
      allocationId: item.allocationId,
      refund: parseCredit(item.refund),
      counterpartyPayment: parseCredit(item.counterpartyPayment),
      platformFee: parseCredit(item.platformFee),
    }));
    const posting = await this.credit.distributeHeld(tx, {
      pathId: path.id,
      pathVersion: path.lockedVersion!,
      requestId: row.id,
      participantAId: path.participantAId,
      participantBId: path.participantBId,
      exchangeType: agreement.exchangeType,
      expectedCredit:
        (agreement.exchangeType === "TWO_WAY"
          ? agreement.totalCreditPerUser
          : agreement.negotiatedCredit) ?? 0n,
      teacherId: agreement.teacherId,
      learnerId: agreement.learnerId,
      policyReference: execution.policyReference,
      allocations,
      now,
    });
    await tx.learningPath.update({
      where: { id: path.id },
      data: { status: "CANCELLED" },
    });
    if (request) {
      await this.requests.markClosed(tx, request.id, request.version);
    }
    const others = await tx.learningChangeRequest.findMany({
      where: {
        pathId: path.id,
        id: { not: row.id },
        status: { in: OPEN_CHANGE_STATUSES },
      },
      orderBy: { id: "asc" },
    });
    // Sequential owner transitions append each request's audit and outbox under the Path lock.
    for (const other of others)
      await this.changes.update(
        tx,
        other,
        "WITHDRAWN",
        actor,
        "Agreement terminated",
        now,
      );
    return this.changes.update(tx, row, "APPLIED", actor, reason, now, {
      operationId: posting.operationId,
      resolution: {
        ...resolution,
        allocations: execution.quote.allocations,
        cancelledSessionIds,
        executionDigest: execution.digest,
        quote: execution.quote,
        policyReference: execution.policyReference,
      },
    });
  }

  queue(actor: Principal, limit: number, after?: string) {
    requireReviewer(actor);
    return this.transactions.run(async (tx) => {
      const now = await databaseNow(tx);
      const rows = await tx.learningChangeRequest.findMany({
        where: {
          kind: "PATH_TERMINATION",
          status: { in: ["ACCEPTED", "STAFF_REVIEW"] },
          OR: [{ expiresAt: { gt: now } }, { approvedAt: { not: null } }],
          ...(after ? { id: { gt: after } } : {}),
        },
        orderBy: { id: "asc" },
        take: limit + 1,
      });
      const page = rows.slice(0, limit);
      const cases = await tx.reportCase.findMany({
        where: {
          relatedPathId: { in: page.map((row) => row.pathId) },
          blocksSettlement: true,
          status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
        },
        select: { relatedPathId: true },
      });
      const blocked = new Set(cases.map((row) => row.relatedPathId));
      const policyReady = !!(await this.changes.policy(tx))
        .terminationPolicyReference;
      return {
        items: page.map((row) =>
          changeView(row, blocked.has(row.pathId), policyReady),
        ),
        nextCursor: rows.length > limit ? page.at(-1)!.id : null,
      };
    });
  }

  private async executionSnapshot(
    tx: TransactionContext,
    path: LearningPath,
    now: Date,
  ) {
    const sessions = await tx.session.findMany({
      where: { pathId: path.id },
      orderBy: { id: "asc" },
      select: {
        id: true,
        status: true,
        startAt: true,
        endAt: true,
        teacherConfirmationStatus: true,
        learnerConfirmationStatus: true,
      },
    });
    const held = await tx.heldCreditAllocation.findMany({
      where: { pathId: path.id },
      orderBy: { id: "asc" },
    });
    const allocations = held.map((item) => ({
      allocationId: item.id,
      userId: item.userId,
      status: item.status,
      lockedPathVersion: item.lockedPathVersion,
      remainingHeld: formatCredit(item.remainingHeld),
    }));
    const snapshot = {
      pathId: path.id,
      version: path.currentVersion,
      lockedVersion: path.lockedVersion,
      status: path.status,
      terminationApprovedAt: path.terminationApprovedAt?.toISOString() ?? null,
      sessions: sessions.map((item) => ({
        ...item,
        startAt: item.startAt.toISOString(),
        endAt: item.endAt.toISOString(),
      })),
      allocations,
      policyReference: (await this.changes.policy(tx))
        .terminationPolicyReference,
    };
    const agreement = await tx.learningPathVersion.findUniqueOrThrow({
      where: {
        pathId_versionNo: { pathId: path.id, versionNo: path.lockedVersion! },
      },
    });
    const quote = await this.credit.previewHeld(tx, {
      pathId: path.id,
      pathVersion: path.lockedVersion!,
      participantAId: path.participantAId,
      participantBId: path.participantBId,
      exchangeType: agreement.exchangeType,
      teacherId: agreement.teacherId,
      learnerId: agreement.learnerId,
      expectedCredit:
        (agreement.exchangeType === "TWO_WAY"
          ? agreement.totalCreditPerUser
          : agreement.negotiatedCredit) ?? 0n,
      now,
      terminationApproved: path.terminationApprovedAt !== null,
    });
    return {
      digest: fingerprintCommand({ ...snapshot, quote }),
      completed: sessions.filter((item) => item.status === "COMPLETED").length,
      total: sessions.length,
      allocations,
      policyReference: snapshot.policyReference,
      quote,
    };
  }

  private async context(
    tx: TransactionContext,
    actor: Principal,
    pathId: string,
  ) {
    await lockLearningPath(tx, pathId);
    const path = await tx.learningPath.findUniqueOrThrow({
      where: { id: pathId },
    });
    assertPathParticipant(actor, path);
    return { path, now: await databaseNow(tx) };
  }

  private async view(
    tx: TransactionContext,
    row: Parameters<typeof changeView>[0],
  ) {
    return changeView(
      row,
      await changeBlockedByDispute(tx, row.pathId),
      !!(await this.changes.policy(tx)).terminationPolicyReference,
    );
  }

  private assertIndependentReviewer(actor: Principal, path: LearningPath) {
    if ([path.participantAId, path.participantBId].includes(actor.userId))
      throw new ForbiddenException("INDEPENDENT_REVIEWER_REQUIRED");
  }
}
