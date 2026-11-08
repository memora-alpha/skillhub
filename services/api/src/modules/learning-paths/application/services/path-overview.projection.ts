import { BadRequestException } from "@nestjs/common";
import type { LearningPath } from "../../../../generated/prisma/client";
import type { Principal } from "../../../auth/application/services/sessions.service";
import type { ParticipantCasesReader } from "../../../reports/application/services/participant-cases.reader";
import type { SessionOverviewReader } from "../../../learning-sessions/application/services/session-overview.reader";
import { sessionAttendanceView } from "../../../learning-sessions/domain/attendance-view";

export type Attention = {
  key: string;
  type: string;
  reasonCode: string;
  status: string;
  waitingOn: string;
  sessionId: string | null;
  deadline: Date | null;
  blocksSettlement: boolean;
  target: { type: string; id: string };
  allowedActions: { code: string; target: { type: string; id: string } }[];
};
type SessionRows = Awaited<ReturnType<SessionOverviewReader["batch"]>>;
type Cases = Awaited<ReturnType<ParticipantCasesReader["batch"]>>;
type PathChange = {
  id: string;
  kind: string;
  status: string;
  sessionId: string | null;
  requesterId: string;
  expiresAt: Date;
  approvedAt: Date | null;
};
export type OverviewContext = {
  actor: Principal;
  path: LearningPath;
  now: Date;
  rows: SessionRows;
  cases: Cases;
  changes: PathChange[];
  attempt?: {
    outcome: string;
    errorCode: string | null;
    checkedAt: Date;
    attemptCount: number;
  };
  plans: {
    planVersionRecord: { totalSessions: number };
    ownedPlanRecord: { teacherId: string; learnerId: string };
  }[];
  disputeHours: number | undefined;
};
type StageSession = {
  status: string;
  teacherFirstJoinedAt: Date | null;
  learnerFirstJoinedAt: Date | null;
};

/** Derive learning progress independently of dispute and settlement state. */
export function learningStage(
  path: Pick<
    LearningPath,
    "status" | "lockedVersion" | "settledAt" | "terminationApprovedAt"
  >,
  sessions: StageSession[],
) {
  if (path.status === "CANCELLED" || path.terminationApprovedAt)
    return "STOPPED";
  if (path.status === "COMPLETED" && path.settledAt) return "COMPLETED";
  if (!path.lockedVersion) return "PREPARING";
  if (!sessions.length) return null;
  if (sessions.every((row) => row.status === "COMPLETED"))
    return "LEARNING_FINISHED";
  if (
    sessions.some(
      (row) =>
        row.teacherFirstJoinedAt ||
        row.learnerFirstJoinedAt ||
        [
          "ONGOING",
          "AWAITING_CONFIRMATION",
          "COMPLETED",
          "NO_SHOW",
          "MAKEUP_REQUIRED",
        ].includes(row.status),
    )
  )
    return "LEARNING";
  if (sessions.some((row) => row.status === "DISPUTED")) return null;
  return "WAITING_START";
}
function attentionRank(item: Attention) {
  if (item.waitingOn === "SELF") return 0;
  return item.blocksSettlement ? 1 : 2;
}
/** Keep actionable items first, then blockers, deadlines and deterministic keys. */
export function sortAttention(items: Attention[]) {
  return items.sort(
    (a, b) =>
      attentionRank(a) - attentionRank(b) ||
      (a.deadline?.getTime() ?? Infinity) -
        (b.deadline?.getTime() ?? Infinity) ||
      a.key.localeCompare(b.key),
  );
}
function reportAttention(row: Cases[number]): Attention {
  const target = { type: "CASE_SUMMARY", id: row.id };
  return {
    key: "case:" + row.id,
    type: "REPORT_CASE",
    reasonCode: row.reasonCode,
    status: row.status,
    waitingOn: row.status === "NEED_MORE_INFO" ? "UNKNOWN" : "STAFF",
    sessionId: row.relatedSessionId,
    deadline: null,
    blocksSettlement: row.blocksSettlement,
    target,
    allowedActions: [{ code: "VIEW_CASE_SUMMARY", target }],
  };
}
function sessionAttention(
  context: OverviewContext,
  row: SessionRows[number],
  openCases: Cases,
): Attention | null {
  const { actor, path, now } = context;
  const session = row.session;
  const reportOpen = openCases.some(
    (item) => item.relatedSessionId === session.id,
  );
  if (
    session.status === "COMPLETED" ||
    session.status === "CANCELLED" ||
    (session.status === "DISPUTED" && reportOpen)
  )
    return null;
  const ownConfirmed =
    (session.teacherId === actor.userId
      ? session.teacherConfirmationStatus
      : session.learnerConfirmationStatus) === "CONFIRMED";
  const view = sessionAttendanceView({
    actorId: actor.userId,
    now,
    canJoin: false,
    pathBlocked:
      !["SCHEDULED", "ACTIVE"].includes(path.status) ||
      !!path.terminationApprovedAt,
    reportOpen,
    session,
    outcome: row.outcome,
    excuse: row.excuse,
  });
  if (
    ![
      "AWAITING_CONFIRMATION",
      "MAKEUP_REQUIRED",
      "NO_SHOW",
      "DISPUTED",
    ].includes(session.status) &&
    !(session.endAt < now && !row.outcome)
  )
    return null;
  let waitingOn = ownConfirmed ? "COUNTERPART" : "SYSTEM";
  if (view.allowedActions.length) waitingOn = "SELF";
  const target = { type: "SESSION", id: session.id };
  return {
    key: "session:" + session.id,
    type: "SESSION",
    reasonCode: "SESSION_" + session.status,
    status: session.status,
    waitingOn,
    sessionId: session.id,
    deadline: session.makeupDeadlineAt ?? session.confirmDeadlineAt,
    blocksSettlement: !path.settledAt,
    target,
    allowedActions: view.allowedActions.map((code) => ({ code, target })),
  };
}
function changeAttention(actorId: string, row: PathChange): Attention {
  let waitingOn = row.requesterId === actorId ? "COUNTERPART" : "SELF";
  if (row.status === "STAFF_REVIEW" || row.approvedAt) waitingOn = "STAFF";
  const target = { type: "LEARNING_CHANGE", id: row.id };
  return {
    key: "change:" + row.id,
    type: row.kind,
    reasonCode: row.kind,
    status: row.status,
    waitingOn,
    sessionId: row.sessionId,
    deadline: row.approvedAt ? null : row.expiresAt,
    blocksSettlement: row.kind === "PATH_TERMINATION",
    target,
    allowedActions: [{ code: "VIEW_CHANGE_REQUEST", target }],
  };
}
function progress(context: OverviewContext, side: "learning" | "teaching") {
  const { actor, path, plans, rows } = context;
  const field = side === "learning" ? "learnerId" : "teacherId";
  const selectedPlans = plans.filter(
    (row) => row.ownedPlanRecord[field] === actor.userId,
  );
  if (!selectedPlans.length) return null;
  const sessions = rows
    .map((row) => row.session)
    .filter((row) => row[field] === actor.userId);
  return {
    completed: sessions.filter((row) => row.status === "COMPLETED").length,
    total: path.lockedVersion
      ? sessions.length
      : selectedPlans.reduce(
          (sum, row) => sum + row.planVersionRecord.totalSessions,
          0,
        ),
  };
}
type SettlementState = {
  status: string;
  reasonCode: string | null;
  nextAction: string;
  autoSettlementAt: Date | null;
  canApprove: boolean;
};
function waitingState(
  status: string,
  nextAction: string,
  reasonCode: string | null = null,
): SettlementState {
  return {
    status,
    reasonCode,
    nextAction,
    autoSettlementAt: null,
    canApprove: false,
  };
}
/** Evaluate the confirmation window only after all session and case blockers pass. */
function completedSettlement(
  context: OverviewContext,
  ownApprovedAt: Date | null,
  partnerApprovedAt: Date | null,
): SettlementState {
  const { rows, now, disputeHours, attempt } = context;
  if (disputeHours === undefined)
    throw new BadRequestException("ATTENDANCE_POLICY_UNAVAILABLE");
  const autoSettlementAt = new Date(
    Math.max(
      ...rows.map(
        (row) =>
          row.outcome?.finalizesAt.getTime() ??
          +row.session.endAt + disputeHours * 3600000,
      ),
    ),
  );
  const state = {
    ...waitingState("READY", "WAIT_FOR_SETTLEMENT"),
    autoSettlementAt,
    canApprove: !ownApprovedAt,
  };
  if (!(ownApprovedAt && partnerApprovedAt) && now < autoSettlementAt) {
    return {
      ...state,
      status: "WAITING_DISPUTE_WINDOW",
      reasonCode: "DISPUTE_WINDOW_OPEN",
      nextAction: ownApprovedAt
        ? "WAIT_FOR_PARTNER_OR_DEADLINE"
        : "APPROVE_IMMEDIATE_SETTLEMENT_OR_WAIT",
    };
  }
  if (attempt?.outcome === "NEEDS_REVIEW" || attempt?.outcome === "RETRYING") {
    return {
      ...state,
      status: attempt.outcome,
      reasonCode: attempt.errorCode,
      nextAction:
        attempt.outcome === "RETRYING" ? "WAIT_FOR_RETRY" : "CONTACT_SUPPORT",
    };
  }
  return state;
}
function settlementState(
  context: OverviewContext,
  ownApprovedAt: Date | null,
  partnerApprovedAt: Date | null,
): SettlementState {
  const { path, changes, cases, rows } = context;
  if (path.settledAt) return waitingState("SETTLED", "VIEW_WALLET_HISTORY");
  if (path.status === "CANCELLED")
    return waitingState("TERMINATED", "VIEW_TERMINATION_DECISION");
  if (!path.lockedVersion)
    return waitingState("NOT_LOCKED", "COMPLETE_AGREEMENT");
  if (changes.some((row) => row.kind === "PATH_TERMINATION"))
    return waitingState(
      "WAITING_TERMINATION",
      "VIEW_TERMINATION_REQUEST",
      "SETTLEMENT_BLOCKED_BY_TERMINATION",
    );
  if (
    cases.some(
      (row) =>
        ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"].includes(row.status) &&
        row.blocksSettlement,
    )
  )
    return waitingState(
      "WAITING_DISPUTE",
      "VIEW_REPORT_CASE",
      "SETTLEMENT_BLOCKED_BY_DISPUTE",
    );
  if (!rows.length || !rows.every((row) => row.session.status === "COMPLETED"))
    return waitingState(
      "WAITING_SESSIONS",
      "COMPLETE_SESSIONS",
      "PATH_SESSIONS_INCOMPLETE",
    );
  if (path.status !== "ACTIVE")
    return waitingState(
      "NEEDS_REVIEW",
      "CONTACT_SUPPORT",
      "LEARNING_PATH_NOT_SETTLEABLE",
    );
  return completedSettlement(context, ownApprovedAt, partnerApprovedAt);
}
function settlementTarget(context: OverviewContext, openCases: Cases) {
  const blocker = openCases.find((row) => row.blocksSettlement);
  if (blocker) return { type: "CASE_SUMMARY", id: blocker.id };
  const termination = context.changes.find(
    (row) => row.kind === "PATH_TERMINATION",
  );
  if (termination) return { type: "LEARNING_CHANGE", id: termination.id };
  return { type: "LEARNING_PATH", id: context.path.id };
}
function primaryAction(
  attention: Attention[],
  next: SessionRows[number]["session"] | undefined,
  pathId: string,
) {
  if (attention.length)
    return { code: "VIEW_PROBLEM", target: attention[0]!.target };
  if (next)
    return {
      code: "VIEW_NEXT_SESSION",
      target: { type: "SESSION", id: next.id },
    };
  return {
    code: "VIEW_SETTLEMENT",
    target: { type: "LEARNING_PATH", id: pathId },
  };
}
/** Project one authorized Path using only the rows fetched for its list page. */
export function projectOverview(context: OverviewContext) {
  const { actor, path, now, rows, cases, changes, attempt } = context;
  const sessions = rows.map((row) => row.session);
  const openCases = cases.filter((row) =>
    ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"].includes(row.status),
  );
  const attention = sortAttention([
    ...openCases.map(reportAttention),
    ...rows
      .map((row) => sessionAttention(context, row, openCases))
      .filter((item): item is Attention => item !== null),
    ...changes.map((row) => changeAttention(actor.userId, row)),
  ]);
  const ownApprovedAt =
    actor.userId === path.participantAId
      ? path.participantASettlementApprovedAt
      : path.participantBSettlementApprovedAt;
  const partnerApprovedAt =
    actor.userId === path.participantAId
      ? path.participantBSettlementApprovedAt
      : path.participantASettlementApprovedAt;
  const state = settlementState(context, ownApprovedAt, partnerApprovedAt);
  const { canApprove, ...settlementFields } = state;
  const settlement = {
    pathId: path.id,
    ...settlementFields,
    settledAt: path.settledAt,
    terminationApprovedAt: path.terminationApprovedAt,
    lastCheckedAt: attempt?.checkedAt ?? null,
    attemptCount: attempt?.attemptCount ?? 0,
    retryable: state.status === "RETRYING" || state.status === "READY",
    pathVersion: path.lockedVersion,
    immediateSettlement: { ownApprovedAt, partnerApprovedAt, canApprove },
    relatedItems: attention
      .filter((row) => row.blocksSettlement)
      .map((row) => row.target),
    nextActionTarget: settlementTarget(context, openCases),
  };
  const next = sessions
    .filter(
      (row) =>
        row.endAt > now &&
        ["CONFIRMED", "READY", "ONGOING"].includes(row.status),
    )
    .sort((a, b) => +a.startAt - +b.startAt || a.id.localeCompare(b.id))[0];
  const stage = learningStage(path, sessions);
  return {
    evaluatedAt: now,
    learningStage: stage,
    stageReasonCode: stage ? null : "LEARNING_STAGE_DATA_INCOMPLETE",
    progress: {
      learning: progress(context, "learning"),
      teaching: progress(context, "teaching"),
      basis: path.lockedVersion ? "LOCKED_AGREEMENT" : "CURRENT_PLAN",
    },
    nextSession: next
      ? {
          id: next.id,
          planId: next.planId,
          startAt: next.startAt,
          endAt: next.endAt,
          role: next.teacherId === actor.userId ? "TEACHER" : "LEARNER",
          status: next.status,
        }
      : null,
    attentionCount: attention.length,
    primaryAttention: attention[0] ?? null,
    primaryAction: primaryAction(attention, next, path.id),
    settlement,
    attentionItems: attention,
    cases,
  };
}
