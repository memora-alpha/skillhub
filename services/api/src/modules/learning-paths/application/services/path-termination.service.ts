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
import type { LearningPath, Prisma } from "../../../../generated/prisma/client";
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
import { PathTerminationPort } from "../../../credit/application/ports/path-termination.port";
import { formatCredit, parseCredit } from "../../../credit/domain/money";
import { validateReason } from "../../../audit/domain/reason.policy";
import { LearningRequestLifecycleService } from "../../../learning-requests/application/services/learning-request-lifecycle.service";
import { LearningRequestPathReader } from "./learning-request-path.reader";

export type TerminationDecision = {
  expectedVersion: number;
  expectedExecutionDigest: string;
  policyReference: string;
  reason: string;
  allocations: {
    allocationId: string;
    refund: string;
    counterpartyPayment: string;
    platformFee: string;
  }[];
};

function requireReviewer(actor: Principal, execute = false) {
  const role =
    actor.roles.includes("ADMIN") ||
    (!execute && actor.roles.includes("STAFF"));
  const required = execute
    ? ["report:moderate", "credit:adjust", "dispute:override"]
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
      const { now } = await this.context(tx, actor, pathId);
      const row = await this.changes.get(
        tx,
        pathId,
        requestId,
        "PATH_TERMINATION",
      );
      return this.view(
        tx,
        await this.changes.respond(tx, actor, row, input, now),
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
        execution: await this.executionSnapshot(tx, path),
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
    const allocations = input.allocations.map((item) => ({
      allocationId: item.allocationId,
      refund: parseCredit(item.refund),
      counterpartyPayment: parseCredit(item.counterpartyPayment),
      platformFee: parseCredit(item.platformFee),
    }));
    const decisionDigest = fingerprintCommand({
      ...input,
      reason,
      allocations: [...input.allocations].sort((a, b) =>
        byCodeUnit(a.allocationId, b.allocationId),
      ),
    });
    return this.transactions.run(async (tx) => {
      const source = await lockLearningPathLifecycle(
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
      if (row.status === "APPLIED") {
        const recorded = row.resolution as { decisionDigest?: string } | null;
        if (
          row.resolvedByUserId !== actor.userId ||
          recorded?.decisionDigest !== decisionDigest
        )
          throw new ConflictException("TERMINATION_DECISION_CONFLICT");
        return this.view(tx, row);
      }
      const now = await databaseNow(tx);
      this.changes.assertOpen(row, input.expectedVersion, now);
      assertChangeablePath(path);
      if (!["ACCEPTED", "STAFF_REVIEW"].includes(row.status))
        throw new ConflictException("TERMINATION_DECISION_NOT_READY");
      const policy = await this.changes.policy(tx);
      if (
        !policy.terminationPolicyReference ||
        input.policyReference !== policy.terminationPolicyReference
      )
        throw new ConflictException("TERMINATION_POLICY_NOT_APPROVED");
      if (await changeBlockedByDispute(tx, pathId))
        throw new ConflictException("TERMINATION_BLOCKED_BY_DISPUTE");
      const execution = await this.executionSnapshot(tx, path);
      if (execution.digest !== input.expectedExecutionDigest)
        throw new ConflictException("STALE_TERMINATION_EXECUTION");
      if (source) {
        const committed = await this.requestPaths.readCommittedPathIds(
          tx,
          source.id,
        );
        if (
          source.status !== "MATCHED" ||
          committed.length !== 1 ||
          committed[0] !== pathId
        )
          throw new ConflictException("REQUEST_LIFECYCLE_INCONSISTENT");
      }
      const cancelledSessionIds = await this.sessions.cancelRemaining(
        tx,
        pathId,
        actor.userId,
        reason,
        now,
      );
      const agreement = await tx.learningPathVersion.findUniqueOrThrow({
        where: {
          pathId_versionNo: { pathId, versionNo: path.lockedVersion! },
        },
      });
      const posting = await this.credit.distributeHeld(tx, {
        pathId,
        pathVersion: path.lockedVersion!,
        requestId,
        participantAId: path.participantAId,
        participantBId: path.participantBId,
        exchangeType: agreement.exchangeType,
        expectedCredit:
          (agreement.exchangeType === "TWO_WAY"
            ? agreement.totalCreditPerUser
            : agreement.negotiatedCredit) ?? 0n,
        teacherId: agreement.teacherId,
        learnerId: agreement.learnerId,
        policyReference: input.policyReference,
        allocations,
        now,
      });
      await tx.learningPath.update({
        where: { id: pathId },
        data: { status: "CANCELLED" },
      });
      if (source) await this.requests.markClosed(tx, source.id, source.version);
      const otherRequests = await tx.learningChangeRequest.findMany({
        where: {
          pathId,
          id: { not: requestId },
          status: { in: OPEN_CHANGE_STATUSES },
        },
        orderBy: { id: "asc" },
      });
      for (const other of otherRequests)
        await this.changes.update(
          tx,
          other,
          "WITHDRAWN",
          null,
          "Agreement terminated",
          now,
        );
      const resolution: Prisma.InputJsonValue = {
        decisionDigest,
        policyReference: input.policyReference,
        reason,
        allocations: input.allocations,
        cancelledSessionIds,
        executionDigest: execution.digest,
      };
      const applied = await this.changes.update(
        tx,
        row,
        "APPLIED",
        actor,
        reason,
        now,
        {
          resolvedByUserId: actor.userId,
          operationId: posting.operationId,
          resolution,
        },
      );
      return this.view(tx, applied);
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
          expiresAt: { gt: now },
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

  private async executionSnapshot(tx: TransactionContext, path: LearningPath) {
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
      sessions: sessions.map((item) => ({
        ...item,
        startAt: item.startAt.toISOString(),
        endAt: item.endAt.toISOString(),
      })),
      allocations,
      policyReference: (await this.changes.policy(tx))
        .terminationPolicyReference,
    };
    return {
      digest: fingerprintCommand(snapshot),
      completed: sessions.filter((item) => item.status === "COMPLETED").length,
      total: sessions.length,
      allocations,
      policyReference: snapshot.policyReference,
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
