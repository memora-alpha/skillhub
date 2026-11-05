import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { absentUserIds } from "../../domain/attendance.policy";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type {
  Session,
  SessionAttendanceOutcome,
} from "../../../../generated/prisma/client";
import { ReputationService } from "../../../reputation/application/services/reputation.service";
import { ReportsService } from "../../../reports/application/services/reports.service";
import type { LiveObservation } from "../../infrastructure/livekit/livekit.service";
import { sessionParticipantIdentity } from "../../domain/session.policy";
import {
  INACTIVE_SESSION_STATUSES,
  closeOpenIntervals,
  recordParticipantEvent,
} from "./session-attendance";
import { databaseNow, lockedSession } from "./session-tx";
import { makeupQuotas } from "./makeup-quota";
import { byCodeUnit } from "../../../../infrastructure/idempotency/idempotency.service";
import {
  completeSession,
  currentOutcome,
  emitSessionEvent,
  finalizeNoShow,
  requireMakeup,
  outcomePolicy,
  hasOpenSessionReport,
} from "./session-transitions";

export type ObservationResult =
  { status: "OK"; observation: LiveObservation | null } | { status: "FAILED" };

/** A connection unseen this long is treated as gone at its last sighting. */
const HEARTBEAT_STALE_MS = 90_000;

@Injectable()
export class SessionOutcomeService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly reputation: ReputationService,
    private readonly reports: ReportsService,
  ) {}

  private async openNoShow(
    tx: TransactionContext,
    actor: Principal,
    sessionId: string,
  ) {
    const session = await lockedSession(tx, sessionId);
    if (
      actor.userId !== session.teacherId &&
      actor.userId !== session.learnerId
    )
      throw new ForbiddenException("SESSION_ACCESS_DENIED");
    const now = await databaseNow(tx);
    const outcome = await currentOutcome(tx, session);
    if (
      session.status !== "NO_SHOW" ||
      outcome?.status !== "PROVISIONAL" ||
      now >= outcome.finalizesAt ||
      outcome.attendanceCase === "BOTH_ABSENT"
    )
      throw new ConflictException("ABSENCE_EXCUSE_NOT_ALLOWED");
    const absent = absentUserIds(session, outcome).includes(actor.userId);
    return { session, outcome, now, absent };
  }

  submitExcuse(actor: Principal, sessionId: string, reason: string) {
    return this.transactions.run(async (tx) => {
      const { session, outcome, absent } = await this.openNoShow(
        tx,
        actor,
        sessionId,
      );
      if (!absent) throw new ConflictException("ABSENCE_EXCUSE_NOT_ALLOWED");
      if (
        await tx.sessionAbsenceExcuse.findUnique({
          where: { outcomeId: outcome.id },
        })
      )
        throw new ConflictException("ABSENCE_EXCUSE_EXISTS");
      const excuse = await tx.sessionAbsenceExcuse.create({
        data: {
          outcomeId: outcome.id,
          absentUserId: actor.userId,
          reason: reason.trim(),
          status: "PENDING",
        },
      });
      await emitSessionEvent(
        tx,
        "session.absence-excuse.submitted",
        session.id,
        `excuse-submitted:${excuse.id}`,
        {
          excuseId: excuse.id,
          absentUserId: actor.userId,
        },
      );
      return { id: excuse.id, status: "PENDING" as const };
    });
  }

  decideExcuse(
    actor: Principal,
    sessionId: string,
    accept: boolean,
    note?: string,
  ) {
    return this.transactions.run(async (tx) => {
      const { session, outcome, now, absent } = await this.openNoShow(
        tx,
        actor,
        sessionId,
      );
      if (absent) throw new ConflictException("ABSENCE_EXCUSE_NOT_ALLOWED");
      const excuse = await tx.sessionAbsenceExcuse.findUnique({
        where: { outcomeId: outcome.id },
      });
      if (excuse?.status !== "PENDING")
        throw new ConflictException("ABSENCE_EXCUSE_NOT_PENDING");
      const status = accept ? ("ACCEPTED" as const) : ("REJECTED" as const);
      await tx.sessionAbsenceExcuse.update({
        where: { id: excuse.id },
        data: {
          status,
          decidedByUserId: actor.userId,
          decidedAt: now,
          decisionNote: note?.trim() || null,
        },
      });
      if (accept) {
        await requireMakeup(
          tx,
          session,
          outcome,
          now,
          outcomePolicy(outcome),
          "EXCUSED",
        );
      }
      await emitSessionEvent(
        tx,
        "session.absence-excuse.decided",
        session.id,
        `excuse-decided:${excuse.id}`,
        {
          excuseId: excuse.id,
          absentUserId: excuse.absentUserId,
          status,
        },
      );
      return { id: excuse.id, status };
    });
  }

  recordObservation(
    expected: Pick<Session, "id" | "startAt" | "endAt">,
    result: ObservationResult,
    now: Date,
  ) {
    return this.transactions.run(async (tx) => {
      const session = await lockedSession(tx, expected.id);
      // The provider answer was fetched outside the transaction; drop it if the schedule moved.
      if (
        +session.startAt !== +expected.startAt ||
        +session.endAt !== +expected.endAt
      )
        return;
      if (
        INACTIVE_SESSION_STATUSES.includes(session.status) ||
        now < session.startAt ||
        now >= session.endAt
      )
        return;
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: session.pathId },
      });
      if (!["SCHEDULED", "ACTIVE"].includes(path.status)) return;
      if (result.status === "FAILED") {
        // Preserve evidence of the first outage in this occurrence.
        if (!session.observationFailedAt)
          await tx.session.update({
            where: { id: session.id },
            data: { observationFailedAt: now },
          });
        return;
      }
      await tx.session.update({
        where: { id: session.id },
        data: { lastObservedAt: now },
      });
      const seen = new Set<string>();
      // Sequential: upserts share the locked Session and must not race each other.
      for (const participant of result.observation?.participants ?? []) {
        const isTeacher =
          participant.identity ===
          sessionParticipantIdentity(session.id, session.teacherId);
        const isLearner =
          participant.identity ===
          sessionParticipantIdentity(session.id, session.learnerId);
        if (!isTeacher && !isLearner) continue;
        seen.add(participant.sid);
        await recordParticipantEvent(tx, {
          sessionId: session.id,
          userId: isTeacher ? session.teacherId : session.learnerId,
          role: isTeacher ? "TEACHER" : "LEARNER",
          roomSid: result.observation!.roomSid,
          participantSid: participant.sid,
          joined: true,
          occurredAt: now,
          observed: true,
        });
      }
      await closeOpenIntervals(
        tx,
        session.id,
        now,
        "HEARTBEAT",
        (interval) =>
          !seen.has(interval.participantSid) &&
          +now - +interval.lastSeenAt >= HEARTBEAT_STALE_MS,
      );
    });
  }

  finalizeDue(sessionId: string) {
    return this.transactions.run(async (tx) => {
      const session = await lockedSession(tx, sessionId);
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: session.pathId },
      });
      if (!["SCHEDULED", "ACTIVE", "DISPUTED"].includes(path.status)) return;
      const now = await databaseNow(tx);
      const outcome = await currentOutcome(tx, session);
      if (session.status === "AWAITING_CONFIRMATION" && outcome)
        return this.timeout(tx, session, outcome, now);
      if (
        session.status === "NO_SHOW" &&
        outcome?.status === "PROVISIONAL" &&
        now >= outcome.finalizesAt
      ) {
        if (await hasOpenSessionReport(tx, session.id)) {
          await tx.sessionAttendanceOutcome.update({
            where: { id: outcome.id },
            data: { status: "DISPUTED" },
          });
          return;
        }
        await tx.sessionAbsenceExcuse.updateMany({
          where: { outcomeId: outcome.id, status: "PENDING" },
          data: { status: "EXPIRED" },
        });
        return this.finalizeNoShowOrReview(
          tx,
          session,
          outcome,
          now,
          outcomePolicy(outcome),
        );
      }
      if (
        session.status === "MAKEUP_REQUIRED" &&
        session.makeupDeadlineAt &&
        now >= session.makeupDeadlineAt
      )
        return this.expireMakeup(tx, session, outcome);
    });
  }

  private async finalizeNoShowOrReview(
    tx: TransactionContext,
    session: Session,
    outcome: SessionAttendanceOutcome,
    now: Date,
    policy: ReturnType<typeof outcomePolicy>,
  ) {
    const path = await tx.learningPath.findUniqueOrThrow({
      where: { id: session.pathId },
    });
    if (path.terminationApprovedAt)
      return finalizeNoShow(tx, this.reputation, session, outcome, now, policy);
    const quotas = await makeupQuotas(
      tx,
      session,
      absentUserIds(session, outcome),
    );
    const quota = quotas.find((value) => value.reason);
    if (outcome.attendanceCase !== "LEARNER_ABSENT" && quota?.reason) {
      // Finalize the existing reputation penalty even when another makeup cannot be granted.
      // Sequential: reputation locks must follow the same deterministic user order.
      for (const userId of absentUserIds(session, outcome).sort(byCodeUnit))
        await this.reputation.applyNoShow(tx, {
          userId,
          sessionId: session.id,
          outcomeId: outcome.id,
          now,
        });
      await this.reports.openSystemSessionCase(tx, {
        sessionId: session.id,
        pathId: session.pathId,
        reasonCode: "MAKEUP_LIMIT_REACHED",
        description: quota.reason,
      });
      await tx.sessionAttendanceOutcome.update({
        where: { id: outcome.id },
        data: {
          status: "DISPUTED",
          resolution: "STAFF_REVIEW",
          finalizedAt: now,
        },
      });
      await tx.session.update({
        where: { id: session.id },
        data: { status: "DISPUTED", confirmDeadlineAt: null },
      });
      return;
    }
    return finalizeNoShow(tx, this.reputation, session, outcome, now, policy);
  }

  private async timeout(
    tx: TransactionContext,
    session: Session,
    outcome: SessionAttendanceOutcome,
    now: Date,
  ) {
    if (!session.confirmDeadlineAt || now < session.confirmDeadlineAt) return;
    const confirmed = [
      session.teacherConfirmationStatus,
      session.learnerConfirmationStatus,
    ].some((status) => status === "CONFIRMED");
    if (outcome.attendanceCase === "BOTH_PRESENT" || confirmed) {
      await completeSession(tx, session, outcome, "COMPLETED_TIMEOUT", now);
      await emitSessionEvent(
        tx,
        "session.completed.timeout",
        session.id,
        `completed-timeout:${outcome.id}`,
        {
          outcomeId: outcome.id,
        },
      );
      return;
    }
    await this.reports.openSystemSessionCase(tx, {
      sessionId: session.id,
      pathId: session.pathId,
      reasonCode: "ATTENDANCE_UNVERIFIABLE",
      description:
        "Attendance could not be verified and neither participant confirmed completion.",
    });
    await tx.sessionAttendanceOutcome.update({
      where: { id: outcome.id },
      data: {
        status: "DISPUTED",
        resolution: "STAFF_REVIEW",
        finalizedAt: now,
      },
    });
    await tx.session.update({
      where: { id: session.id },
      data: { status: "DISPUTED", confirmDeadlineAt: null },
    });
  }

  private async expireMakeup(
    tx: TransactionContext,
    session: Session,
    outcome: SessionAttendanceOutcome | null,
  ) {
    await this.reports.openSystemSessionCase(tx, {
      sessionId: session.id,
      pathId: session.pathId,
      reasonCode: "MAKEUP_EXPIRED",
      description: "No makeup time was agreed before the makeup deadline.",
    });
    await tx.session.update({
      where: { id: session.id },
      data: { status: "DISPUTED", makeupDeadlineAt: null },
    });
    if (outcome)
      await tx.sessionAttendanceOutcome.update({
        where: { id: outcome.id },
        data: { status: "DISPUTED", resolution: "STAFF_REVIEW" },
      });
    await emitSessionEvent(
      tx,
      "session.makeup.expired",
      session.id,
      `makeup-expired:${session.id}:${+session.makeupDeadlineAt!}`,
      {},
    );
  }
}
