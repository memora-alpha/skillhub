import { randomUUID } from "node:crypto";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type {
  Prisma,
  Session,
  SessionResolution,
  SessionAttendanceOutcome,
} from "../../../../generated/prisma/client";
import {
  absentUserIds,
  attendanceCase,
  attendedSeconds,
  determinationAt,
  hoursAfter,
  isAbsentCase,
  observationHealthy,
  participantVerdict,
  daysAfter,
  type AttendancePolicy,
} from "../../domain/attendance.policy";
import type { AttendanceContext } from "./session-tx";
import { parseConfigurationValue } from "../../../system-configuration/domain/configuration.catalog";
import { byCodeUnit } from "../../../../infrastructure/idempotency/idempotency.service";
import { ConflictException } from "@nestjs/common";
import { lockedSession } from "./session-tx";
import { reserveMakeup } from "./makeup-quota";

export type NoShowReputation = {
  applyNoShow(
    tx: TransactionContext,
    input: { userId: string; sessionId: string; outcomeId: string; now: Date },
  ): Promise<void>;
};

const UNDECIDED = ["CONFIRMED", "READY", "ONGOING", "AWAITING_CONFIRMATION"];

/** Decisions for an existing occurrence always use its persisted policy. */
export function outcomePolicy(
  outcome: Pick<SessionAttendanceOutcome, "evidence">,
): AttendancePolicy {
  const evidence = outcome.evidence as Record<string, unknown>;
  return parseConfigurationValue("session.attendancePolicy", evidence.policy);
}

export async function hasOpenSessionReport(
  tx: TransactionContext,
  sessionId: string,
) {
  return (
    (await tx.reportCase.findFirst({
      where: {
        relatedSessionId: sessionId,
        status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
      },
      select: { id: true },
    })) !== null
  );
}

export function currentOutcome(
  tx: TransactionContext,
  session: Pick<Session, "id" | "startAt">,
) {
  return tx.sessionAttendanceOutcome.findUnique({
    where: {
      sessionId_occurrenceStartAt: {
        sessionId: session.id,
        occurrenceStartAt: session.startAt,
      },
    },
  });
}

export function emitSessionEvent(
  tx: TransactionContext,
  type: string,
  sessionId: string,
  dedupeKey: string,
  payload: Record<string, unknown>,
) {
  return tx.outboxEvent.create({
    data: {
      eventId: randomUUID(),
      correlationId: randomUUID(),
      aggregateType: "SESSION",
      aggregateId: sessionId,
      type,
      version: 1,
      dedupeKey,
      payload: { sessionId, ...payload } as Prisma.InputJsonValue,
    },
  });
}

export async function refreshPathStatus(
  tx: TransactionContext,
  pathId: string,
) {
  const remaining = await tx.session.count({
    where: { pathId, status: { not: "COMPLETED" } },
  });
  if (remaining !== 0) return;
  const current = await tx.learningPath.findUniqueOrThrow({
    where: { id: pathId },
  });
  // A delayed completion/report event must never reopen a financially closed agreement.
  if (current.status === "CANCELLED" || current.settledAt) return;
  // A dispute keeps the path DISPUTED; report resolution moves it back to ACTIVE.
  const path =
    current.status === "DISPUTED"
      ? current
      : await tx.learningPath.update({
          where: { id: pathId },
          data: { status: "ACTIVE" },
        });
  await tx.outboxEvent.create({
    data: {
      eventId: randomUUID(),
      correlationId: randomUUID(),
      aggregateType: "LEARNING_PATH",
      aggregateId: pathId,
      type: "learning-path.sessions-completed",
      version: 1,
      dedupeKey: `path.sessions-completed:${pathId}:${path.lockedVersion}`,
      payload: { pathId, lockedVersion: path.lockedVersion },
    },
  });
}

export async function completeSession(
  tx: TransactionContext,
  session: Pick<Session, "id" | "pathId">,
  outcome: { id: string; finalizedAt: Date | null } | null,
  resolution: SessionResolution,
  now: Date,
) {
  await tx.session.update({
    where: { id: session.id },
    data: { status: "COMPLETED", confirmDeadlineAt: null },
  });
  if (outcome)
    await tx.sessionAttendanceOutcome.update({
      where: { id: outcome.id },
      data: { resolution, finalizedAt: outcome.finalizedAt ?? now },
    });
  await refreshPathStatus(tx, session.pathId);
}

/** Creates the occurrence outcome once Td passed; returns null while it is not due. */
export async function determineOutcome(
  tx: TransactionContext,
  session: Session,
  now: Date,
  context: AttendanceContext,
) {
  const existing = await currentOutcome(tx, session);
  if (existing || !UNDECIDED.includes(session.status) || now < session.endAt)
    return existing;
  const liveKitAvailable =
    context.liveKitEnabled && context.joinLateMinutes !== null;
  const dueAt = determinationAt(
    session.endAt,
    liveKitAvailable ? context.joinLateMinutes! : 0,
    context.policy,
  );
  if (now < dueAt) return null;
  const intervals = await tx.sessionAttendanceInterval.findMany({
    where: { sessionId: session.id },
    orderBy: { joinedAt: "asc" },
  });
  const healthy = observationHealthy(session);
  const side = (userId: string, tokenIssuedAt: Date | null) => {
    // Intervals that ended before this occurrence belong to an earlier (makeup) occurrence.
    const own = intervals.filter(
      (row) =>
        row.userId === userId &&
        +(row.leftAt ?? row.lastSeenAt) > +session.startAt,
    );
    const seconds = attendedSeconds(own, session.startAt, session.endAt);
    const firstJoinedAt = own[0]?.joinedAt ?? null;
    return {
      seconds,
      firstJoinedAt,
      ...participantVerdict({
        tokenIssued: tokenIssuedAt !== null,
        seconds,
        firstJoinedAt,
        startAt: session.startAt,
        endAt: session.endAt,
        policy: context.policy,
        liveKitAvailable,
        observationHealthy: healthy,
      }),
    };
  };
  const teacher = side(session.teacherId, session.teacherTokenIssuedAt);
  const learner = side(session.learnerId, session.learnerTokenIssuedAt);
  const value = attendanceCase(teacher.verdict, learner.verdict);
  const absent = isAbsentCase(value);
  const disputed = absent && (await hasOpenSessionReport(tx, session.id));
  let outcomeStatus: "FINAL" | "PROVISIONAL" | "DISPUTED" = absent
    ? "PROVISIONAL"
    : "FINAL";
  if (disputed) outcomeStatus = "DISPUTED";
  const outcome = await tx.sessionAttendanceOutcome.create({
    data: {
      sessionId: session.id,
      occurrenceStartAt: session.startAt,
      occurrenceEndAt: session.endAt,
      teacherVerdict: teacher.verdict,
      learnerVerdict: learner.verdict,
      teacherLate: teacher.late,
      learnerLate: learner.late,
      teacherSeconds: BigInt(teacher.seconds),
      learnerSeconds: BigInt(learner.seconds),
      teacherFirstJoinedAt: teacher.firstJoinedAt,
      learnerFirstJoinedAt: learner.firstJoinedAt,
      attendanceCase: value,
      status: outcomeStatus,
      determinedAt: now,
      finalizesAt: hoursAfter(session.endAt, context.policy.disputeWindowHours),
      evidence: {
        policy: context.policy,
        joinLateMinutes: context.joinLateMinutes,
        liveKitAvailable,
        observationHealthy: healthy,
        lastObservedAt: session.lastObservedAt?.toISOString() ?? null,
        observationFailedAt: session.observationFailedAt?.toISOString() ?? null,
        teacherTokenIssuedAt:
          session.teacherTokenIssuedAt?.toISOString() ?? null,
        learnerTokenIssuedAt:
          session.learnerTokenIssuedAt?.toISOString() ?? null,
        intervals: intervals.map((row) => ({
          userId: row.userId,
          participantSid: row.participantSid,
          joinedAt: row.joinedAt.toISOString(),
          leftAt: row.leftAt?.toISOString() ?? null,
          lastSeenAt: row.lastSeenAt.toISOString(),
          closeSource: row.closeSource,
        })),
      },
    },
  });
  await tx.session.update({
    where: { id: session.id },
    data: {
      teacherAttendanceSeconds: BigInt(teacher.seconds),
      learnerAttendanceSeconds: BigInt(learner.seconds),
      ...(absent
        ? { status: "NO_SHOW" as const }
        : {
            status: "AWAITING_CONFIRMATION" as const,
            // Counted from the decision so a late worker never shortens the window.
            confirmDeadlineAt: hoursAfter(
              now,
              context.policy.confirmWindowHours,
            ),
          }),
    },
  });
  await emitSessionEvent(
    tx,
    "session.attendance.determined",
    session.id,
    `attendance-determined:${outcome.id}`,
    {
      outcomeId: outcome.id,
      attendanceCase: value,
      absentUserIds: absentUserIds(session, outcome),
    },
  );
  return outcome;
}

export async function requireMakeup(
  tx: TransactionContext,
  session: Session,
  outcome: Pick<SessionAttendanceOutcome, "id" | "evidence">,
  now: Date,
  policy: AttendancePolicy,
  outcomeStatus: "FINAL" | "EXCUSED",
) {
  // Staff may extend the booking deadline of the same granted occurrence, never grant a second one.
  const evidence = outcome.evidence as Prisma.JsonObject;
  if (evidence.makeupGranted !== true) await reserveMakeup(tx, session);
  await tx.sessionAttendanceOutcome.update({
    where: { id: outcome.id },
    data: {
      status: outcomeStatus,
      resolution: "MAKEUP_REQUIRED",
      finalizedAt: now,
      evidence: { ...evidence, makeupGranted: true },
    },
  });
  await tx.session.update({
    where: { id: session.id },
    data: {
      status: "MAKEUP_REQUIRED",
      confirmDeadlineAt: null,
      makeupDeadlineAt: daysAfter(now, policy.makeupWindowDays),
    },
  });
}

export async function finalizeNoShow(
  tx: TransactionContext,
  reputation: NoShowReputation,
  session: Session,
  outcome: SessionAttendanceOutcome,
  now: Date,
  policy: AttendancePolicy,
) {
  const absent = absentUserIds(session, outcome).sort(byCodeUnit);
  // Sequential: each penalty locks that user's reputation row in a fixed order.
  for (const userId of absent)
    await reputation.applyNoShow(tx, {
      userId,
      sessionId: session.id,
      outcomeId: outcome.id,
      now,
    });
  if (outcome.attendanceCase === "LEARNER_ABSENT") {
    await tx.sessionAttendanceOutcome.update({
      where: { id: outcome.id },
      data: { status: "FINAL", finalizedAt: now },
    });
    await completeSession(
      tx,
      session,
      { id: outcome.id, finalizedAt: now },
      "COMPLETED_LEARNER_NO_SHOW",
      now,
    );
  } else {
    await requireMakeup(tx, session, outcome, now, policy, "FINAL");
  }
  await emitSessionEvent(
    tx,
    "session.no-show.finalized",
    session.id,
    `no-show-finalized:${outcome.id}`,
    {
      outcomeId: outcome.id,
      absentUserIds: absent,
    },
  );
}

export type NoShowRuling = "UPHOLD" | "EXCUSE" | "COMPLETE";

/** Staff decision for a Session held by a report case; runs inside the resolve transaction. */
export async function applyNoShowRuling(
  tx: TransactionContext,
  reputation: NoShowReputation,
  input: { sessionId: string; ruling: NoShowRuling; now: Date },
) {
  const session = await lockedSession(tx, input.sessionId);
  const outcome = await currentOutcome(tx, session);
  if (
    !outcome ||
    !["NO_SHOW", "DISPUTED", "MAKEUP_REQUIRED"].includes(session.status)
  )
    throw new ConflictException("NO_SHOW_RULING_NOT_APPLICABLE");
  const absent = isAbsentCase(outcome.attendanceCase);
  const policy = outcomePolicy(outcome);
  if (input.ruling === "UPHOLD") {
    if (!absent || session.status !== "NO_SHOW")
      throw new ConflictException("NO_SHOW_RULING_NOT_APPLICABLE");
    return finalizeNoShow(tx, reputation, session, outcome, input.now, policy);
  }
  if (input.ruling === "EXCUSE")
    return requireMakeup(
      tx,
      session,
      outcome,
      input.now,
      policy,
      absent ? "EXCUSED" : "FINAL",
    );
  await tx.sessionAttendanceOutcome.update({
    where: { id: outcome.id },
    data: { status: absent ? "OVERTURNED" : "FINAL", finalizedAt: input.now },
  });
  await completeSession(
    tx,
    session,
    { id: outcome.id, finalizedAt: input.now },
    "COMPLETED_STAFF",
    input.now,
  );
}

/** A closed report without ruling lets the no-show finalise normally, unless another case holds it. */
export async function releaseDisputedOutcome(
  tx: TransactionContext,
  sessionId: string,
  closingCaseId: string,
) {
  const others = await tx.reportCase.count({
    where: {
      relatedSessionId: sessionId,
      id: { not: closingCaseId },
      status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
    },
  });
  if (others === 0)
    await tx.sessionAttendanceOutcome.updateMany({
      where: { sessionId, status: "DISPUTED" },
      data: { status: "PROVISIONAL" },
    });
}
