import { ConflictException, Injectable } from "@nestjs/common";
import type { Principal } from "../../../auth/application/services/sessions.service";
import type {
  LearningChangeRequest,
  Session,
} from "../../../../generated/prisma/client";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  LearningChangeState,
  assertPathParticipant,
  changeBlockedByDispute,
  changeView,
} from "../../../learning-paths/application/services/learning-change-state";
import { databaseNow, lockedSession, lockSession } from "./session-tx";
import { completeSession } from "./session-transitions";
import { makeupQuota, reserveMakeup } from "./makeup-quota";

@Injectable()
export class SessionChangesService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly changes: LearningChangeState,
  ) {}

  request(
    actor: Principal,
    sessionId: string,
    key: string,
    input: { reason: string; expectedStartAt: string },
  ) {
    return this.transactions.run(async (tx) => {
      const { session, path, now } = await this.context(tx, actor, sessionId);
      const row = await this.changes.create(
        tx,
        actor,
        path,
        {
          kind: "SESSION_CANCELLATION",
          key,
          reason: input.reason,
          expectedStartAt: input.expectedStartAt,
          session,
        },
        now,
      );
      return changeView(row, await changeBlockedByDispute(tx, path.id), true);
    });
  }

  list(actor: Principal, sessionId: string) {
    return this.transactions.run(async (tx) => {
      const { path, now } = await this.context(tx, actor, sessionId);
      await this.changes.expire(tx, path.id, now);
      const rows = await tx.learningChangeRequest.findMany({
        where: { sessionId, kind: "SESSION_CANCELLATION" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      });
      const blocked = await changeBlockedByDispute(tx, path.id);
      return rows.map((row) => changeView(row, blocked, true));
    });
  }

  respond(
    actor: Principal,
    sessionId: string,
    requestId: string,
    input: { expectedVersion: number; accept: boolean; note?: string },
  ) {
    return this.transactions.run(async (tx) => {
      const { session, path, now } = await this.context(tx, actor, sessionId);
      const row = await this.cancellation(tx, path.id, sessionId, requestId);
      if (input.accept && row.status === "PENDING") {
        const quota = await makeupQuota(tx, session, row.requesterId);
        if (quota.reason) throw new ConflictException(quota.reason);
      }
      const decided = await this.changes.respond(tx, actor, row, input, now);
      const applied = await this.apply(tx, decided, session, now, actor);
      return changeView(
        applied,
        await changeBlockedByDispute(tx, path.id),
        true,
      );
    });
  }

  withdraw(
    actor: Principal,
    sessionId: string,
    requestId: string,
    expectedVersion: number,
  ) {
    return this.transactions.run(async (tx) => {
      const { path, now } = await this.context(tx, actor, sessionId);
      const row = await this.cancellation(tx, path.id, sessionId, requestId);
      return changeView(
        await this.changes.withdraw(tx, actor, row, expectedVersion, now),
        false,
        true,
      );
    });
  }

  /** Recovery entry: rechecks occurrence, path, deadline and disputes under the same locks. */
  recover(sessionId: string, requestId: string) {
    return this.transactions.run(async (tx) => {
      const session = await lockedSession(tx, sessionId);
      const now = await databaseNow(tx);
      await this.changes.expire(tx, session.pathId, now);
      const row = await this.cancellation(
        tx,
        session.pathId,
        sessionId,
        requestId,
      );
      return this.apply(tx, row, session, now, null);
    });
  }

  /** Session owner contract; caller has User -> Request -> Path locks. */
  async ruleCancelledMakeup(
    tx: TransactionContext,
    sessionId: string,
    ruling: "EXTEND" | "COMPLETE",
    now: Date,
  ) {
    const session = await lockedSession(tx, sessionId);
    const cancellation = await tx.learningChangeRequest.findFirst({
      where: {
        sessionId,
        kind: "SESSION_CANCELLATION",
        status: "APPLIED",
        occurrenceStartAt: session.startAt,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (
      !cancellation ||
      !["DISPUTED", "MAKEUP_REQUIRED"].includes(session.status)
    )
      throw new ConflictException("CANCELLATION_MAKEUP_RULING_NOT_APPLICABLE");
    if (ruling === "COMPLETE")
      return completeSession(tx, session, null, "COMPLETED_STAFF", now);
    const policy = cancellation.policySnapshot as { makeupWindowDays: number };
    await tx.session.update({
      where: { id: sessionId },
      data: {
        status: "MAKEUP_REQUIRED",
        makeupDeadlineAt: new Date(+now + policy.makeupWindowDays * 86_400_000),
      },
    });
  }

  /** Session owner contract; caller has User -> Request -> Path locks. */
  async cancelRemaining(
    tx: TransactionContext,
    pathId: string,
    actorId: string,
    reason: string,
    now: Date,
  ) {
    const rows = await tx.session.findMany({
      where: { pathId },
      orderBy: { id: "asc" },
    });
    // Sequential: all Session writers take Path then Session; stable order for a multi-session decision.
    for (const row of rows) await lockSession(tx, row.id);
    const current = await tx.session.findMany({
      where: { pathId },
      orderBy: { id: "asc" },
    });
    if (
      current.some(
        (row) =>
          !["COMPLETED", "CANCELLED", "MAKEUP_REQUIRED"].includes(row.status) &&
          (!["CONFIRMED", "READY"].includes(row.status) || row.startAt <= now),
      )
    )
      throw new ConflictException("TERMINATION_SESSION_RULING_REQUIRED");
    await tx.session.updateMany({
      where: { pathId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      data: {
        status: "CANCELLED",
        cancelledByUserId: actorId,
        cancelledAt: now,
        cancelReason: reason,
        confirmDeadlineAt: null,
        makeupDeadlineAt: null,
      },
    });
    return current
      .filter((row) => !["COMPLETED", "CANCELLED"].includes(row.status))
      .map((row) => row.id);
  }

  private async context(
    tx: TransactionContext,
    actor: Principal,
    sessionId: string,
  ) {
    const session = await lockedSession(tx, sessionId);
    const path = await tx.learningPath.findUniqueOrThrow({
      where: { id: session.pathId },
    });
    assertPathParticipant(actor, path);
    return { session, path, now: await databaseNow(tx) };
  }

  private async cancellation(
    tx: TransactionContext,
    pathId: string,
    sessionId: string,
    requestId: string,
  ) {
    const row = await this.changes.get(
      tx,
      pathId,
      requestId,
      "SESSION_CANCELLATION",
    );
    if (row.sessionId !== sessionId)
      throw new ConflictException("CHANGE_REQUEST_SESSION_MISMATCH");
    return row;
  }

  private async apply(
    tx: TransactionContext,
    row: LearningChangeRequest,
    session: Session,
    now: Date,
    actor: Principal | null,
  ) {
    if (row.status !== "ACCEPTED") return row;
    const path = await tx.learningPath.findUniqueOrThrow({
      where: { id: row.pathId },
    });
    if (
      now >= row.expiresAt ||
      +session.startAt !== +row.occurrenceStartAt! ||
      !["CONFIRMED", "READY"].includes(session.status) ||
      path.settledAt ||
      path.status === "CANCELLED"
    )
      return this.changes.update(
        tx,
        row,
        "EXPIRED",
        actor,
        "Cancellation no longer matches an upcoming occurrence",
        now,
      );
    if (await changeBlockedByDispute(tx, row.pathId)) return row;
    if (!["SCHEDULED", "ACTIVE"].includes(path.status))
      throw new ConflictException("LEARNING_PATH_CANNOT_BE_CHANGED");
    const quota = await makeupQuota(tx, session, row.requesterId);
    if (quota.reason)
      return this.changes.update(tx, row, "EXPIRED", actor, quota.reason, now);
    const policy = row.policySnapshot as { makeupWindowDays?: number };
    if (
      !Number.isInteger(policy.makeupWindowDays) ||
      policy.makeupWindowDays! < 1 ||
      policy.makeupWindowDays! > 90
    )
      throw new ConflictException("CANCELLATION_POLICY_SNAPSHOT_INVALID");
    await reserveMakeup(tx, session, [row.requesterId]);
    await tx.session.update({
      where: { id: session.id },
      data: {
        status: "MAKEUP_REQUIRED",
        cancelledByUserId: row.requesterId,
        cancelledAt: now,
        cancelReason: row.reason,
        makeupDeadlineAt: new Date(
          +now + policy.makeupWindowDays! * 86_400_000,
        ),
        confirmDeadlineAt: null,
      },
    });
    return this.changes.update(tx, row, "APPLIED", actor, row.reason, now, {
      resolution: {
        outcome: "MAKEUP_REQUIRED",
        creditPenalty: "0.00",
        responsibility: "UNDETERMINED",
      },
    });
  }
}
