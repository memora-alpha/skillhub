import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  absentUserIds,
  CANCELLATION_RULING_STATUSES,
  isAbsentCase,
  NO_SHOW_RULING_STATUSES,
  type AttendanceCaseValue,
  type Verdict,
} from "../../domain/attendance.policy";
import { makeupQuotas } from "./makeup-quota";
import { currentOutcome } from "./session-transitions";

export type RulingOption<V extends string> = {
  value: V;
  allowed: boolean;
  blockedReason: string | null;
};

export type SessionRulingOptions = {
  makeupQuotas: { userId: string; reason: string | null; remaining: number }[];
  eligibleMakeupUserIds: string[];
  makeupAlreadyGranted: boolean;
  obligationsEnded: boolean;
  noShowRulings: RulingOption<"UPHOLD" | "EXCUSE" | "COMPLETE">[];
  cancellationMakeupRulings: RulingOption<"EXTEND" | "COMPLETE">[];
};

type ProjectionInput = {
  session: { status: string; teacherId: string; learnerId: string };
  outcome: {
    attendanceCase: AttendanceCaseValue;
    teacherVerdict: Verdict;
    learnerVerdict: Verdict;
    evidence: unknown;
  } | null;
  obligationsEnded: boolean;
  quotas: { userId: string; reason: string | null; remaining: number }[];
  cancellationApplied: boolean;
};

const NOT_APPLICABLE = "NO_SHOW_RULING_NOT_APPLICABLE";
const CANCELLATION_NOT_APPLICABLE = "CANCELLATION_MAKEUP_RULING_NOT_APPLICABLE";

const option = <V extends string>(
  value: V,
  blockedReason: string | null,
): RulingOption<V> => ({
  value,
  allowed: blockedReason === null,
  blockedReason,
});

/**
 * Advisory projection of the checks applyNoShowRuling/ruleCancelledMakeup run on
 * committed state. The resolve transaction revalidates; this never grants access.
 */
export function projectSessionRulingOptions(
  input: ProjectionInput,
): SessionRulingOptions {
  const { session, outcome, obligationsEnded, quotas } = input;
  const granted =
    (outcome?.evidence as Record<string, unknown> | null)?.makeupGranted ===
    true;
  const eligible = quotas.filter((q) => !q.reason).map((q) => q.userId);
  // requireMakeup reserves a new makeup only when obligations remain and none is granted.
  const reservationBlock = (userIds: string[]) => {
    if (obligationsEnded || granted) return null;
    if (!userIds.length) return "MAKEUP_USER_REQUIRED";
    return (
      quotas.find((q) => userIds.includes(q.userId) && q.reason)?.reason ?? null
    );
  };
  const applicable =
    outcome !== null && NO_SHOW_RULING_STATUSES.includes(session.status);
  let uphold: string | null = NOT_APPLICABLE;
  let excuse: string | null = NOT_APPLICABLE;
  if (applicable) {
    const absent = absentUserIds(session, outcome);
    if (isAbsentCase(outcome.attendanceCase) && session.status === "NO_SHOW")
      uphold =
        outcome.attendanceCase === "LEARNER_ABSENT"
          ? null
          : reservationBlock(absent);
    // Without an absent party, EXCUSE uses the participant Staff selects:
    // allowed when anyone is eligible, otherwise blocked by the first reason.
    let excuseUsers = absent;
    if (!excuseUsers.length)
      excuseUsers = eligible.length ? eligible : quotas.map((q) => q.userId);
    excuse = reservationBlock(excuseUsers);
  }
  const cancellation =
    input.cancellationApplied &&
    CANCELLATION_RULING_STATUSES.includes(session.status)
      ? null
      : CANCELLATION_NOT_APPLICABLE;
  return {
    makeupQuotas: quotas.map(({ userId, reason, remaining }) => ({
      userId,
      reason,
      remaining,
    })),
    eligibleMakeupUserIds: eligible,
    makeupAlreadyGranted: granted,
    obligationsEnded,
    noShowRulings: [
      option("UPHOLD", uphold),
      option("EXCUSE", excuse),
      option("COMPLETE", applicable ? null : NOT_APPLICABLE),
    ],
    cancellationMakeupRulings: [
      option("EXTEND", cancellation),
      option("COMPLETE", cancellation),
    ],
  };
}

/** Reads the committed state a Staff ruling on this Session would be checked against. */
export async function loadSessionRulingOptions(
  tx: TransactionContext,
  sessionId: string,
): Promise<SessionRulingOptions | null> {
  const session = await tx.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      pathId: true,
      teacherId: true,
      learnerId: true,
      makeupCount: true,
      status: true,
      startAt: true,
    },
  });
  if (!session) return null;
  const outcome = await currentOutcome(tx, session);
  const path = await tx.learningPath.findUnique({
    where: { id: session.pathId },
    select: { terminationApprovedAt: true },
  });
  const cancellation = await tx.learningChangeRequest.findFirst({
    where: {
      sessionId,
      kind: "SESSION_CANCELLATION",
      status: "APPLIED",
      occurrenceStartAt: session.startAt,
    },
    select: { id: true },
  });
  const quotas = await makeupQuotas(tx, session, [
    session.teacherId,
    session.learnerId,
  ]);
  return projectSessionRulingOptions({
    session,
    outcome,
    obligationsEnded: !!path?.terminationApprovedAt,
    quotas,
    cancellationApplied: cancellation !== null,
  });
}
