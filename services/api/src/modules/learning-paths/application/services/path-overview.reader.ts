import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { LearningPath } from "../../../../generated/prisma/client";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { ParticipantCasesReader } from "../../../reports/application/services/participant-cases.reader";
import { SessionOverviewReader } from "../../../learning-sessions/application/services/session-overview.reader";
import { sessionAttendanceView } from "../../../learning-sessions/domain/attendance-view";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import { databaseNow } from "../../../learning-sessions/application/services/session-tx";
import {
  assertPathParticipant,
  OPEN_CHANGE_STATUSES,
} from "./learning-change-state";

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
type StageSession = {
  status: string;
  teacherFirstJoinedAt: Date | null;
  learnerFirstJoinedAt: Date | null;
};
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
export function sortAttention(items: Attention[]) {
  const rank = (item: Attention) =>
    item.waitingOn === "SELF" ? 0 : item.blocksSettlement ? 1 : 2;
  return items.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.deadline?.getTime() ?? Infinity) -
        (b.deadline?.getTime() ?? Infinity) ||
      a.key.localeCompare(b.key),
  );
}
@Injectable()
export class PathOverviewReader {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly sessions: SessionOverviewReader,
    private readonly cases: ParticipantCasesReader,
    private readonly configuration: SystemConfigurationService,
  ) {}
  async batch(tx: TransactionContext, actor: Principal, paths: LearningPath[]) {
    const ids = paths.map((path) => path.id);
    for (const path of paths) assertPathParticipant(actor, path);
    if (!ids.length)
      return new Map<string, Awaited<ReturnType<typeof this.project>>>();
    const now = await databaseNow(tx);
    const [sessionRows, cases, changes, attempts, plans] = await Promise.all([
      this.sessions.batch(tx, ids),
      this.cases.batch(tx, actor.userId, ids),
      tx.learningChangeRequest.findMany({
        where: {
          pathId: { in: ids },
          status: { in: OPEN_CHANGE_STATUSES },
          OR: [{ expiresAt: { gt: now } }, { approvedAt: { not: null } }],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      tx.pathSettlementAttempt.findMany({ where: { pathId: { in: ids } } }),
      tx.pathVersionPlan.findMany({
        where: { pathId: { in: ids } },
        include: { ownedPlanRecord: true, planVersionRecord: true },
      }),
    ]);
    const needsDeadline = paths.some(
      (path) =>
        !path.settledAt &&
        path.lockedVersion &&
        sessionRows.some((row) => row.session.pathId === path.id) &&
        sessionRows
          .filter((row) => row.session.pathId === path.id)
          .every((row) => row.session.status === "COMPLETED"),
    );
    const hours = needsDeadline
      ? (await this.configuration.getSnapshot(["session.attendancePolicy"], tx))
          .values["session.attendancePolicy"]?.disputeWindowHours
      : undefined;
    const entries = paths.map((path) => {
      const links = plans.filter(
        (row) =>
          row.pathId === path.id &&
          row.pathVersion === (path.lockedVersion ?? path.currentVersion),
      );
      const sessions = sessionRows.filter(
        (row) =>
          row.session.pathId === path.id &&
          links.some(
            (link) =>
              link.planId === row.session.planId &&
              link.planVersion === row.session.planVersion,
          ),
      );
      return [
        path.id,
        this.project(
          actor,
          path,
          now,
          sessions,
          cases.filter((row) => row.relatedPathId === path.id),
          changes.filter((row) => row.pathId === path.id),
          attempts.find((row) => row.pathId === path.id),
          links,
          hours,
        ),
      ] as const;
    });
    return new Map(entries);
  }
  private project(
    actor: Principal,
    path: LearningPath,
    now: Date,
    rows: Awaited<ReturnType<SessionOverviewReader["batch"]>>,
    cases: Awaited<ReturnType<ParticipantCasesReader["batch"]>>,
    changes: {
      id: string;
      kind: string;
      status: string;
      sessionId: string | null;
      requesterId: string;
      expiresAt: Date;
      approvedAt: Date | null;
    }[],
    attempt:
      | {
          outcome: string;
          errorCode: string | null;
          checkedAt: Date;
          attemptCount: number;
        }
      | undefined,
    plans: {
      planVersionRecord: { totalSessions: number };
      ownedPlanRecord: { teacherId: string; learnerId: string };
    }[],
    disputeHours: number | undefined,
  ) {
    const sessions = rows.map((row) => row.session);
    const openCases = cases.filter((row) =>
      ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"].includes(row.status),
    );
    const attention: Attention[] = openCases.map((row) => ({
      key: "case:" + row.id,
      type: "REPORT_CASE",
      reasonCode: row.reasonCode,
      status: row.status,
      waitingOn: row.status === "NEED_MORE_INFO" ? "UNKNOWN" : "STAFF",
      sessionId: row.relatedSessionId,
      deadline: null,
      blocksSettlement: row.blocksSettlement,
      target: { type: "CASE_SUMMARY", id: row.id },
      allowedActions: [
        {
          code: "VIEW_CASE_SUMMARY",
          target: { type: "CASE_SUMMARY", id: row.id },
        },
      ],
    }));
    for (const row of rows) {
      const session = row.session;
      if (
        session.status === "COMPLETED" ||
        session.status === "CANCELLED" ||
        (session.status === "DISPUTED" &&
          openCases.some((item) => item.relatedSessionId === session.id))
      )
        continue;
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
        reportOpen: openCases.some(
          (item) => item.relatedSessionId === session.id,
        ),
        session,
        outcome: row.outcome,
        excuse: row.excuse,
      });
      if (
        [
          "AWAITING_CONFIRMATION",
          "MAKEUP_REQUIRED",
          "NO_SHOW",
          "DISPUTED",
        ].includes(session.status) ||
        (session.endAt < now && !row.outcome)
      ) {
        attention.push({
          key: "session:" + session.id,
          type: "SESSION",
          reasonCode: "SESSION_" + session.status,
          status: session.status,
          waitingOn: view.allowedActions.length
            ? "SELF"
            : ownConfirmed
              ? "COUNTERPART"
              : "SYSTEM",
          sessionId: session.id,
          deadline: session.makeupDeadlineAt ?? session.confirmDeadlineAt,
          blocksSettlement: !path.settledAt,
          target: { type: "SESSION", id: session.id },
          allowedActions: view.allowedActions.map((code) => ({
            code,
            target: { type: "SESSION", id: session.id },
          })),
        });
      }
    }
    for (const row of changes)
      attention.push({
        key: "change:" + row.id,
        type: row.kind,
        reasonCode: row.kind,
        status: row.status,
        waitingOn:
          row.status === "STAFF_REVIEW" || row.approvedAt
            ? "STAFF"
            : row.requesterId === actor.userId
              ? "COUNTERPART"
              : "SELF",
        sessionId: row.sessionId,
        deadline: row.approvedAt ? null : row.expiresAt,
        blocksSettlement: row.kind === "PATH_TERMINATION",
        target: { type: "LEARNING_CHANGE", id: row.id },
        allowedActions: [
          {
            code: "VIEW_CHANGE_REQUEST",
            target: { type: "LEARNING_CHANGE", id: row.id },
          },
        ],
      });
    sortAttention(attention);
    const count = (side: "learning" | "teaching") => {
      const field = side === "learning" ? "learnerId" : "teacherId";
      const selectedPlans = plans.filter(
        (row) => row.ownedPlanRecord[field] === actor.userId,
      );
      if (!selectedPlans.length) return null;
      return {
        completed: sessions.filter(
          (row) => row[field] === actor.userId && row.status === "COMPLETED",
        ).length,
        total: path.lockedVersion
          ? sessions.filter((row) => row[field] === actor.userId).length
          : selectedPlans.reduce(
              (sum, row) => sum + row.planVersionRecord.totalSessions,
              0,
            ),
      };
    };
    const ended =
      sessions.length > 0 &&
      sessions.every((row) => row.status === "COMPLETED");
    const ownApprovedAt =
      actor.userId === path.participantAId
        ? path.participantASettlementApprovedAt
        : path.participantBSettlementApprovedAt;
    const partnerApprovedAt =
      actor.userId === path.participantAId
        ? path.participantBSettlementApprovedAt
        : path.participantASettlementApprovedAt;
    const termination = changes.find((row) => row.kind === "PATH_TERMINATION");
    const blocker = openCases.find((row) => row.blocksSettlement);
    let status = "READY",
      reasonCode: string | null = null,
      nextAction = "WAIT_FOR_SETTLEMENT";
    let autoSettlementAt: Date | null = null,
      canApprove = false;
    if (path.settledAt) {
      status = "SETTLED";
      nextAction = "VIEW_WALLET_HISTORY";
    } else if (path.status === "CANCELLED") {
      status = "TERMINATED";
      nextAction = "VIEW_TERMINATION_DECISION";
    } else if (!path.lockedVersion) {
      status = "NOT_LOCKED";
      nextAction = "COMPLETE_AGREEMENT";
    } else if (termination) {
      status = "WAITING_TERMINATION";
      reasonCode = "SETTLEMENT_BLOCKED_BY_TERMINATION";
      nextAction = "VIEW_TERMINATION_REQUEST";
    } else if (blocker) {
      status = "WAITING_DISPUTE";
      reasonCode = "SETTLEMENT_BLOCKED_BY_DISPUTE";
      nextAction = "VIEW_REPORT_CASE";
    } else if (!ended) {
      status = "WAITING_SESSIONS";
      reasonCode = "PATH_SESSIONS_INCOMPLETE";
      nextAction = "COMPLETE_SESSIONS";
    } else if (path.status !== "ACTIVE") {
      status = "NEEDS_REVIEW";
      reasonCode = "LEARNING_PATH_NOT_SETTLEABLE";
      nextAction = "CONTACT_SUPPORT";
    } else {
      if (disputeHours === undefined)
        throw new BadRequestException("ATTENDANCE_POLICY_UNAVAILABLE");
      autoSettlementAt = new Date(
        Math.max(
          ...rows.map(
            (row) =>
              row.outcome?.finalizesAt.getTime() ??
              +row.session.endAt + disputeHours * 3600000,
          ),
        ),
      );
      canApprove = !ownApprovedAt;
      if (!(ownApprovedAt && partnerApprovedAt) && now < autoSettlementAt) {
        status = "WAITING_DISPUTE_WINDOW";
        reasonCode = "DISPUTE_WINDOW_OPEN";
        nextAction = ownApprovedAt
          ? "WAIT_FOR_PARTNER_OR_DEADLINE"
          : "APPROVE_IMMEDIATE_SETTLEMENT_OR_WAIT";
      } else if (
        attempt?.outcome === "NEEDS_REVIEW" ||
        attempt?.outcome === "RETRYING"
      ) {
        status = attempt.outcome;
        reasonCode = attempt.errorCode;
        nextAction =
          status === "RETRYING" ? "WAIT_FOR_RETRY" : "CONTACT_SUPPORT";
      }
    }
    const settlement = {
      pathId: path.id,
      status,
      reasonCode,
      nextAction,
      settledAt: path.settledAt,
      terminationApprovedAt: path.terminationApprovedAt,
      lastCheckedAt: attempt?.checkedAt ?? null,
      attemptCount: attempt?.attemptCount ?? 0,
      retryable: status === "RETRYING" || status === "READY",
      pathVersion: path.lockedVersion,
      autoSettlementAt,
      immediateSettlement: { ownApprovedAt, partnerApprovedAt, canApprove },
      relatedItems: attention
        .filter((row) => row.blocksSettlement)
        .map((row) => row.target),
      nextActionTarget: blocker
        ? { type: "CASE_SUMMARY", id: blocker.id }
        : termination
          ? { type: "LEARNING_CHANGE", id: termination.id }
          : { type: "LEARNING_PATH", id: path.id },
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
        learning: count("learning"),
        teaching: count("teaching"),
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
      primaryAction: attention.length
        ? { code: "VIEW_PROBLEM", target: attention[0]!.target }
        : next
          ? {
              code: "VIEW_NEXT_SESSION",
              target: { type: "SESSION", id: next.id },
            }
          : {
              code: "VIEW_SETTLEMENT",
              target: { type: "LEARNING_PATH", id: path.id },
            },
      settlement,
      attentionItems: attention,
      cases,
    };
  }
  read(actor: Principal, pathId: string) {
    return this.transactions.run(async (tx) => {
      const path = await tx.learningPath.findUnique({ where: { id: pathId } });
      if (!path) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
      return (await this.batch(tx, actor, [path])).get(pathId)!;
    });
  }
}

export function overviewCard(
  view: Awaited<ReturnType<PathOverviewReader["read"]>>,
) {
  return {
    evaluatedAt: view.evaluatedAt,
    learningStage: view.learningStage,
    stageReasonCode: view.stageReasonCode,
    progress: view.progress,
    nextSession: view.nextSession,
    attentionCount: view.attentionCount,
    primaryAttention: view.primaryAttention,
    primaryAction: view.primaryAction,
    settlement: view.settlement,
  };
}
