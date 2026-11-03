import {
  isAbsentCase,
  type AttendanceCaseValue,
  type Verdict,
} from "./attendance.policy";

export type SessionAction =
  | "JOIN"
  | "CONFIRM_COMPLETION"
  | "SUBMIT_EXCUSE"
  | "DECIDE_EXCUSE"
  | "REPORT_NO_SHOW"
  | "PROPOSE_MAKEUP";

type OutcomeView = {
  attendanceCase: AttendanceCaseValue;
  status: string;
  resolution: string | null;
  teacherVerdict: Verdict;
  learnerVerdict: Verdict;
  teacherLate: boolean;
  learnerLate: boolean;
  teacherSeconds: bigint;
  learnerSeconds: bigint;
  teacherFirstJoinedAt: Date | null;
  learnerFirstJoinedAt: Date | null;
  determinedAt: Date;
  finalizesAt: Date;
};

export type AttendanceViewInput = {
  actorId: string;
  now: Date;
  canJoin: boolean;
  reportOpen: boolean;
  pathBlocked: boolean;
  session: {
    teacherId: string;
    learnerId: string;
    status: string;
    endAt: Date;
    teacherConfirmationStatus: string | null;
    learnerConfirmationStatus: string | null;
    teacherFirstJoinedAt: Date | null;
    learnerFirstJoinedAt: Date | null;
    confirmDeadlineAt: Date | null;
    makeupDeadlineAt: Date | null;
  };
  outcome: OutcomeView | null;
  excuse: { status: string; reason: string; absentUserId: string } | null;
};

function attendanceState(input: AttendanceViewInput) {
  if (input.outcome)
    return input.outcome.attendanceCase === "UNVERIFIABLE"
      ? "UNVERIFIABLE"
      : "DETERMINED";
  return input.now >= input.session.endAt ? "PENDING_DATA" : null;
}

function noShowActions(
  input: AttendanceViewInput,
  isTeacher: boolean,
): SessionAction[] {
  const { outcome, excuse } = input;
  if (
    input.session.status !== "NO_SHOW" ||
    outcome?.status !== "PROVISIONAL" ||
    input.now >= outcome.finalizesAt
  )
    return [];
  const ownVerdict = isTeacher
    ? outcome.teacherVerdict
    : outcome.learnerVerdict;
  const actions: SessionAction[] = [];
  if (
    ownVerdict === "ABSENT" &&
    outcome.attendanceCase !== "BOTH_ABSENT" &&
    !excuse
  )
    actions.push("SUBMIT_EXCUSE");
  if (ownVerdict !== "ABSENT" && excuse?.status === "PENDING")
    actions.push("DECIDE_EXCUSE");
  if (!input.reportOpen) actions.push("REPORT_NO_SHOW");
  return actions;
}

export function sessionAttendanceView(input: AttendanceViewInput) {
  const { session, outcome, excuse, now } = input;
  const isTeacher = input.actorId === session.teacherId;
  const ownConfirmed =
    (isTeacher
      ? session.teacherConfirmationStatus
      : session.learnerConfirmationStatus) === "CONFIRMED";
  const actions: SessionAction[] = [];
  if (input.canJoin && !input.pathBlocked) actions.push("JOIN");
  if (
    session.status === "AWAITING_CONFIRMATION" &&
    !input.pathBlocked &&
    outcome &&
    !isAbsentCase(outcome.attendanceCase) &&
    !ownConfirmed &&
    session.confirmDeadlineAt &&
    now < session.confirmDeadlineAt
  )
    actions.push("CONFIRM_COMPLETION");
  actions.push(...noShowActions(input, isTeacher));
  if (
    session.status === "MAKEUP_REQUIRED" &&
    !input.pathBlocked &&
    session.makeupDeadlineAt &&
    now < session.makeupDeadlineAt
  )
    actions.push("PROPOSE_MAKEUP");
  const side = (role: "teacher" | "learner") => ({
    verdict: outcome?.[`${role}Verdict`] ?? null,
    late: outcome?.[`${role}Late`] ?? false,
    // Counters are written only at determination, so before it the total is 0.
    seconds: (outcome?.[`${role}Seconds`] ?? 0n).toString(),
    firstJoinedAt: outcome
      ? outcome[`${role}FirstJoinedAt`]
      : session[`${role}FirstJoinedAt`],
  });
  return {
    attendance: {
      state: attendanceState(input),
      case: outcome?.attendanceCase ?? null,
      teacher: side("teacher"),
      learner: side("learner"),
      absentUserIds: [
        ...(outcome?.teacherVerdict === "ABSENT" ? [session.teacherId] : []),
        ...(outcome?.learnerVerdict === "ABSENT" ? [session.learnerId] : []),
      ],
      outcomeStatus: outcome?.status ?? null,
      resolution: outcome?.resolution ?? null,
      determinedAt: outcome?.determinedAt ?? null,
    },
    deadlines: {
      confirmBy: session.confirmDeadlineAt,
      excuseOrReportBy:
        outcome && isAbsentCase(outcome.attendanceCase)
          ? outcome.finalizesAt
          : null,
      makeupBy: session.makeupDeadlineAt,
    },
    excuse,
    allowedActions: actions,
  };
}
