import {
  listInput,
  listBoundary,
  listResult,
} from "../../../../shared/http/list-page";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  databaseNow,
  loadAttendanceContext,
  lockedSession,
} from "./session-tx";
import {
  completeSession,
  currentOutcome,
  determineOutcome,
} from "./session-transitions";
import { sessionAttendanceView } from "../../domain/attendance-view";
import { isAbsentCase } from "../../domain/attendance.policy";
import {
  INACTIVE_SESSION_STATUSES,
  closeOpenIntervals,
  recordParticipantEvent,
} from "./session-attendance";
import { CLOCK, type Clock } from "../../../../shared/time/clock";
import { parseAbsoluteTimestamp } from "../../../../shared/time/timestamp.policy";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import { LiveKitService } from "../../infrastructure/livekit/livekit.service";
import {
  sessionJoinAccess,
  sessionParticipantIdentity,
  sessionStatusAt,
  type JoinWindowPolicy,
} from "../../domain/session.policy";
import {
  sessionReadSelect,
  type LiveKitTokenResponse,
} from "../../presentation/http/learning-sessions.responses";
import type {
  Session,
  LearningPath,
  Prisma,
} from "../../../../generated/prisma/client";
import type { WebhookEvent } from "livekit-server-sdk";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { byCodeUnit } from "../../../../infrastructure/idempotency/idempotency.service";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { PathSettlementPort } from "../../../credit/application/ports/credit.ports";
import { formatCredit as creditText } from "../../../credit/domain/money";
import { ReputationService } from "../../../reputation/application/services/reputation.service";
import { AchievementsService } from "../../../reputation/application/services/achievements.service";
import { ReportsService } from "../../../reports/application/services/reports.service";
import { LearningRequestLifecycleService } from "../../../learning-requests/application/services/learning-request-lifecycle.service";
import { LearningRequestPathReader } from "../../../learning-paths/application/services/learning-request-path.reader";
import { lockLearningPathLifecycle } from "../../../learning-paths/application/services/learning-path-lock";
import { pendingTermination } from "../../../learning-paths/application/services/learning-change-state";
import {
  recordSettlementAttempt,
  settlementFailure,
} from "../../../learning-paths/application/services/path-settlement-state";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import { roleCodes } from "../../../../shared/authorization/principal-actor";
import { randomUUID } from "node:crypto";
import { makeupQuota } from "./makeup-quota";

/** First join moves earlier and last leave moves later; other activity is ignored. */
function participantActivityData(
  session: Pick<
    Session,
    | "teacherFirstJoinedAt"
    | "learnerFirstJoinedAt"
    | "teacherLastLeftAt"
    | "learnerLastLeftAt"
  >,
  isTeacher: boolean,
  joined: boolean,
  occurredAt: Date,
) {
  if (joined) {
    const key = isTeacher ? "teacherFirstJoinedAt" : "learnerFirstJoinedAt";
    const firstJoined = session[key];
    return !firstJoined || occurredAt < firstJoined
      ? { [key]: occurredAt }
      : {};
  }
  const key = isTeacher ? "teacherLastLeftAt" : "learnerLastLeftAt";
  const lastLeft = session[key];
  return !lastLeft || occurredAt > lastLeft ? { [key]: occurredAt } : {};
}

function confirmationData(isTeacher: boolean, now: Date, note: string) {
  return isTeacher
    ? {
        teacherConfirmationStatus: "CONFIRMED" as const,
        teacherConfirmedAt: now,
        teacherConfirmationNote: note,
      }
    : {
        learnerConfirmationStatus: "CONFIRMED" as const,
        learnerConfirmedAt: now,
        learnerConfirmationNote: note,
      };
}

const TRACKED_LIVEKIT_EVENTS = new Set([
  "participant_joined",
  "participant_left",
  "room_finished",
]);

@Injectable()
export class LearningSessionsService {
  private readonly logger = new Logger(LearningSessionsService.name);
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly db: PrismaService,
    private readonly settlement: PathSettlementPort,
    private readonly reputation: ReputationService,
    private readonly achievements: AchievementsService,
    private readonly reports: ReportsService,
    private readonly configuration: SystemConfigurationService,
    private readonly livekit: LiveKitService,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly requests: LearningRequestLifecycleService,
    private readonly requestPaths: LearningRequestPathReader,
    private readonly audit: AuditWriter,
  ) {}

  private async joinPolicy(
    tx?: TransactionContext,
  ): Promise<JoinWindowPolicy | null> {
    try {
      const snapshot = await this.configuration.getSnapshot(
        ["livekit.joinWindow"],
        tx,
      );
      return snapshot.values["livekit.joinWindow"] ?? null;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) return null;
      throw error;
    }
  }

  private assertParticipant(
    actor: Principal,
    session: Pick<Session, "teacherId" | "learnerId">,
  ) {
    if (
      actor.userId !== session.teacherId &&
      actor.userId !== session.learnerId
    )
      throw new ForbiddenException("SESSION_ACCESS_DENIED");
  }

  private async authorizeSession(actor: Principal, sessionId: string) {
    const session = await this.db.session.findUnique({
      where: { id: sessionId },
      select: { teacherId: true, learnerId: true },
    });
    if (!session) throw new NotFoundException("SESSION_NOT_FOUND");
    this.assertParticipant(actor, session);
  }

  async issueLiveKitToken(
    actor: Principal,
    sessionId: string,
  ): Promise<LiveKitTokenResponse> {
    if (!actor.permissions.includes("livekit-token:issue:participant"))
      throw new ForbiddenException("SESSION_ACCESS_DENIED");
    return this.transactions.run(async (tx) => {
      const session = await lockedSession(tx, sessionId);
      this.assertParticipant(actor, session);
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: session.pathId },
      });
      if (!path.lockedVersion || !["SCHEDULED", "ACTIVE"].includes(path.status))
        throw new ConflictException("SESSION_NOT_JOINABLE");
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (!(clock?.now instanceof Date))
        throw new ServiceUnavailableException("DATABASE_TIME_UNAVAILABLE");
      const policy = await this.joinPolicy(tx);
      const access = sessionJoinAccess(
        session,
        clock.now,
        policy,
        this.livekit.config.enabled,
      );
      if (!access.canJoin || !access.opensAt || !access.closesAt) {
        if (
          access.reason === "LIVEKIT_DISABLED" ||
          access.reason === "LIVEKIT_POLICY_NOT_READY"
        )
          throw new ServiceUnavailableException(access.reason);
        throw new ConflictException(access.reason ?? "SESSION_NOT_JOINABLE");
      }
      const config = this.livekit.config;
      if (!config.enabled)
        throw new ServiceUnavailableException("LIVEKIT_DISABLED");
      const roomName = session.roomName ?? `skillhub-session-${session.id}`;
      const participantIdentity = sessionParticipantIdentity(
        session.id,
        actor.userId,
      );
      const expiresAt = new Date(
        Math.floor(Math.min(+clock.now + 120_000, +access.closesAt) / 1000) *
          1000,
      );
      if (+expiresAt <= +clock.now)
        throw new ConflictException("JOIN_WINDOW_CLOSED");
      // First issuance per occurrence is the server-side proof a participant could join.
      const data: Prisma.SessionUpdateInput = {};
      if (!session.roomName) data.roomName = roomName;
      if (actor.userId === session.teacherId) {
        if (!session.teacherTokenIssuedAt)
          data.teacherTokenIssuedAt = clock.now;
      } else if (!session.learnerTokenIssuedAt) {
        data.learnerTokenIssuedAt = clock.now;
      }
      if (Object.keys(data).length)
        await tx.session.update({ where: { id: session.id }, data });
      const participantToken = await this.livekit.issueParticipantToken({
        roomName,
        identity: participantIdentity,
        expiresAt,
      });
      return {
        serverUrl: config.url,
        participantToken,
        roomName,
        participantIdentity,
        expiresAt,
        joinOpensAt: access.opensAt,
        joinClosesAt: access.closesAt,
      };
    });
  }

  private async attendanceInputs(
    actorId: string,
    sessions: { id: string; startAt: Date; pathId: string }[],
  ) {
    const ids = sessions.map(({ id }) => id);
    const paths = await this.db.learningPath.findMany({
      where: { id: { in: [...new Set(sessions.map(({ pathId }) => pathId))] } },
      select: { id: true, status: true },
    });
    const outcomes = (
      await this.db.sessionAttendanceOutcome.findMany({
        where: { sessionId: { in: ids } },
      })
    ).filter((row) =>
      sessions.some(
        (s) => s.id === row.sessionId && +s.startAt === +row.occurrenceStartAt,
      ),
    );
    const excuses = await this.db.sessionAbsenceExcuse.findMany({
      where: { outcomeId: { in: outcomes.map(({ id }) => id) } },
      select: {
        outcomeId: true,
        status: true,
        reason: true,
        absentUserId: true,
      },
    });
    const reports = await this.db.reportCase.findMany({
      where: {
        reporterId: actorId,
        relatedSessionId: { in: ids },
        status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
      },
      select: { relatedSessionId: true },
    });
    return (sessionId: string) => {
      const outcome =
        outcomes.find((row) => row.sessionId === sessionId) ?? null;
      const excuse = outcome
        ? excuses.find((row) => row.outcomeId === outcome.id)
        : undefined;
      return {
        outcome,
        excuse: excuse
          ? {
              status: excuse.status,
              reason: excuse.reason,
              absentUserId: excuse.absentUserId,
            }
          : null,
        reportOpen: reports.some((row) => row.relatedSessionId === sessionId),
        pathBlocked: !paths.some(
          (path) =>
            path.id === sessions.find((row) => row.id === sessionId)?.pathId &&
            ["SCHEDULED", "ACTIVE"].includes(path.status),
        ),
      };
    };
  }

  async mine(
    actor: Principal,
    from?: string,
    to?: string,
    query: { limit?: number; cursor?: string } = {},
  ) {
    const scope = JSON.stringify([
      "sessions-mine-v1",
      actor.userId,
      from ?? null,
      to ?? null,
    ]);
    const { limit, cursor } = listInput(query, scope);
    let start: Date;
    let end: Date | undefined;
    try {
      start = from
        ? parseAbsoluteTimestamp(from)
        : new Date(cursor?.anchor ?? this.clock.now());
      end = to ? parseAbsoluteTimestamp(to) : undefined;
    } catch {
      throw new BadRequestException("INVALID_SESSION_DATE_RANGE");
    }
    if (
      !Number.isFinite(start.getTime()) ||
      (end && (!Number.isFinite(end.getTime()) || end < start))
    ) {
      throw new BadRequestException("INVALID_SESSION_DATE_RANGE");
    }
    const sessions = await this.db.session.findMany({
      where: {
        OR: [{ teacherId: actor.userId }, { learnerId: actor.userId }],
        ...listBoundary("startAt", cursor, true),
        ...(end
          ? { startAt: { gte: start, lte: end } }
          : { endAt: { gte: start } }),
      },
      orderBy: [{ startAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      select: {
        id: true,
        pathId: true,
        planId: true,
        teacherId: true,
        learnerId: true,
        startAt: true,
        endAt: true,
        status: true,
        originalStartAt: true,
        rescheduleCount: true,
        makeupCount: true,
        makeupUserIds: true,
        teacherConfirmationStatus: true,
        learnerConfirmationStatus: true,
        teacherFirstJoinedAt: true,
        learnerFirstJoinedAt: true,
        confirmDeadlineAt: true,
        makeupDeadlineAt: true,
      },
    });
    const result = listResult(
      sessions,
      limit,
      scope,
      (row) => row.startAt,
      start,
    );
    const policy = await this.joinPolicy();
    const now = this.clock.now();
    const inputsFor = await this.attendanceInputs(actor.userId, result.data);
    const reportingFor = await this.reports.reportingForSessions(
      this.db,
      actor.userId,
      result.data,
    );
    const data = result.data.map(
      ({
        teacherFirstJoinedAt,
        learnerFirstJoinedAt,
        confirmDeadlineAt,
        makeupDeadlineAt,
        ...session
      }) => {
        const status = sessionStatusAt(session, now, policy);
        const join = sessionJoinAccess(
          session,
          now,
          policy,
          this.livekit.config.enabled,
        );
        const view = sessionAttendanceView({
          actorId: actor.userId,
          now,
          canJoin: join.canJoin,
          session: {
            ...session,
            status,
            teacherFirstJoinedAt,
            learnerFirstJoinedAt,
            confirmDeadlineAt,
            makeupDeadlineAt,
          },
          ...inputsFor(session.id),
        });
        return {
          ...session,
          status,
          join,
          role: actor.userId === session.teacherId ? "TEACHER" : "LEARNER",
          attendance: { state: view.attendance.state },
          deadlines: {
            ...view.deadlines,
            reportBy: reportingFor.get(session.id)!.reportBy,
          },
          reporting: reportingFor.get(session.id)!,
          allowedActions: view.allowedActions,
        };
      },
    );
    return { data, pagination: result.pagination };
  }

  async detail(actor: Principal, sessionId: string) {
    await this.authorizeSession(actor, sessionId);
    // Reads may materialise a due outcome so clients never wait for the worker.
    await this.ensureDetermined(sessionId);
    const session = await this.db.session.findUniqueOrThrow({
      where: { id: sessionId },
      select: sessionReadSelect,
    });
    const policy = await this.joinPolicy();
    const now = this.clock.now();
    const join = sessionJoinAccess(
      session,
      now,
      policy,
      this.livekit.config.enabled,
    );
    const status = sessionStatusAt(session, now, policy);
    const reporting = (
      await this.reports.reportingForSessions(this.db, actor.userId, [session])
    ).get(session.id)!;
    const attendanceView = sessionAttendanceView({
      actorId: actor.userId,
      now,
      canJoin: join.canJoin,
      session: { ...session, status },
      ...(await this.attendanceInputs(actor.userId, [session]))(session.id),
    });
    return {
      ...session,
      status,
      role: actor.userId === session.teacherId ? "TEACHER" : "LEARNER",
      join,
      progress: await this.progress(session.pathId, session.planId),
      makeupQuota: await makeupQuota(this.db, session, actor.userId),
      ...attendanceView,
      deadlines: { ...attendanceView.deadlines, reportBy: reporting.reportBy },
      reporting,
    };
  }

  private async progress(pathId: string, planId: string) {
    const path = await this.db.learningPath.findUniqueOrThrow({
      where: { id: pathId },
      select: { lockedVersion: true },
    });
    const links = path.lockedVersion
      ? await this.db.pathVersionPlan.findMany({
          where: { pathId, pathVersion: path.lockedVersion },
          select: { planId: true, planVersion: true },
        })
      : [];
    const versions = new Map(
      links.map((link) => [link.planId, link.planVersion]),
    );
    const sessions = await this.db.session.findMany({
      where: { pathId },
      select: { planId: true, planVersion: true, status: true },
    });
    const current = sessions.filter(
      (session) => versions.get(session.planId) === session.planVersion,
    );
    const count = (rows: typeof current) => ({
      total: rows.length,
      completed: rows.filter((row) => row.status === "COMPLETED").length,
    });
    return {
      agreement: count(current),
      plan: count(current.filter((row) => row.planId === planId)),
    };
  }

  async applyLiveKitActivity(tx: TransactionContext, event: WebhookEvent) {
    if (!event.room?.name || !TRACKED_LIVEKIT_EVENTS.has(event.event)) return;
    const initial = await tx.session.findUnique({
      where: { roomName: event.room.name },
    });
    if (!initial) return;
    const session = await lockedSession(tx, initial.id);
    const path = await tx.learningPath.findUniqueOrThrow({
      where: { id: session.pathId },
    });
    if (
      !["SCHEDULED", "ACTIVE"].includes(path.status) ||
      INACTIVE_SESSION_STATUSES.includes(session.status)
    )
      return;
    if (
      !event.room.sid ||
      (session.providerRoomId && session.providerRoomId !== event.room.sid)
    )
      return;
    const now = await databaseNow(tx);
    const policy = await this.joinPolicy(tx);
    if (!policy) return;
    const providerAt = new Date(Number(event.createdAt) * 1000);
    // Bound provider clock skew; join windows and state transitions still use DB time.
    const occurredAt = new Date(Math.min(+providerAt, +now));
    if (!Number.isFinite(+occurredAt)) return;
    const schedule = await tx.sessionScheduleHistory.findFirst({
      where: { sessionId: session.id, supersededAt: null },
      orderBy: { appliedAt: "desc" },
    });
    // Provider createdAt has whole-second precision, including events in the apply second.
    if (schedule && +providerAt < Math.floor(+schedule.appliedAt / 1000) * 1000)
      return;
    // Roll back the receipt so provider clock skew cannot permanently discard activity.
    if (+providerAt - +now > 5000)
      throw new ServiceUnavailableException("LIVEKIT_EVENT_NOT_YET_CURRENT");
    if (event.event === "room_finished") {
      await closeOpenIntervals(tx, session.id, occurredAt, "ROOM_FINISHED");
      return;
    }
    const identity = event.participant?.identity;
    const isTeacher =
      identity === sessionParticipantIdentity(session.id, session.teacherId);
    const isLearner =
      identity === sessionParticipantIdentity(session.id, session.learnerId);
    if (!isTeacher && !isLearner) return;
    if (!sessionJoinAccess(session, occurredAt, policy, true).canJoin) return;
    const joined = event.event === "participant_joined";
    let status = sessionStatusAt(session, now, policy);
    if (joined && occurredAt >= session.startAt && now < session.endAt)
      status = "ONGOING";
    await tx.session.update({
      where: { id: session.id },
      data: {
        status,
        providerRoomId: event.room.sid,
        ...participantActivityData(session, isTeacher, joined, occurredAt),
      },
    });
    if (event.participant?.sid)
      await recordParticipantEvent(tx, {
        sessionId: session.id,
        userId: isTeacher ? session.teacherId : session.learnerId,
        role: isTeacher ? "TEACHER" : "LEARNER",
        roomSid: event.room.sid,
        participantSid: event.participant.sid,
        joined,
        occurredAt,
      });
  }

  async reconcileLiveKitRoom(event: WebhookEvent) {
    if (
      !event.room?.name ||
      !event.room.sid ||
      !["participant_joined", "participant_left"].includes(event.event)
    )
      return;
    const expected = await this.db.session.findUnique({
      where: { roomName: event.room.name },
    });
    if (!expected?.providerRoomId || expected.providerRoomId === event.room.sid)
      return;
    let observation;
    try {
      observation = await this.livekit.listActiveParticipants(event.room.name);
    } catch {
      throw new ServiceUnavailableException("LIVEKIT_OBSERVATION_UNAVAILABLE");
    }
    if (observation?.roomSid === event.room.sid)
      await this.advanceLifecycle(expected, observation);
  }

  async advanceLifecycle(
    expected: Pick<
      Session,
      "id" | "startAt" | "endAt" | "roomName" | "providerRoomId"
    >,
    observation: { roomSid: string; identities: string[] } | null,
  ) {
    return this.transactions.run(async (tx) => {
      const session = await lockedSession(tx, expected.id);
      // A provider response fetched outside the transaction may belong to the old schedule.
      if (
        +session.startAt !== +expected.startAt ||
        +session.endAt !== +expected.endAt ||
        session.roomName !== expected.roomName ||
        session.providerRoomId !== expected.providerRoomId
      )
        return;
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: session.pathId },
      });
      if (
        !["SCHEDULED", "ACTIVE"].includes(path.status) ||
        INACTIVE_SESSION_STATUSES.includes(session.status)
      )
        return;
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (!(clock?.now instanceof Date))
        throw new ServiceUnavailableException("DATABASE_TIME_UNAVAILABLE");
      const policy = await this.joinPolicy(tx);
      let status = sessionStatusAt(session, clock.now, policy);
      const active = observation?.identities.some(
        (id) =>
          id === sessionParticipantIdentity(session.id, session.teacherId) ||
          id === sessionParticipantIdentity(session.id, session.learnerId),
      );
      if (
        active &&
        policy &&
        clock.now >= session.startAt &&
        clock.now < session.endAt
      )
        status = "ONGOING";
      await tx.session.update({
        where: { id: session.id },
        data: {
          status,
          ...(observation ? { providerRoomId: observation.roomSid } : {}),
        },
      });
    });
  }

  /** Materialises the occurrence outcome when due; a no-op before Td or without policy. */
  async ensureDetermined(sessionId: string) {
    await this.transactions.run(async (tx) => {
      const session = await lockedSession(tx, sessionId);
      const context = await loadAttendanceContext(
        this.configuration,
        this.livekit.config.enabled,
        tx,
      );
      if (context)
        await determineOutcome(tx, session, await databaseNow(tx), context);
    });
  }

  async complete(actor: Principal, sessionId: string, note: string) {
    await this.authorizeSession(actor, sessionId);
    // Own transaction: a rejected confirm must not roll the determination back.
    await this.ensureDetermined(sessionId);
    return this.transactions.run(async (tx) => {
      const session = await lockedSession(tx, sessionId);
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: session.pathId },
      });
      if (path.status === "DISPUTED")
        throw new ConflictException("SESSION_BLOCKED_BY_DISPUTE");
      const isTeacher = actor.userId === session.teacherId;
      if (!isTeacher && actor.userId !== session.learnerId)
        throw new ForbiddenException("SESSION_ACCESS_DENIED");
      if (session.status === "COMPLETED")
        return { id: sessionId, status: session.status };
      if (["CANCELLED", "DISPUTED", "MAKEUP_REQUIRED"].includes(session.status))
        throw new ConflictException("SESSION_CANNOT_BE_COMPLETED");
      const now = await databaseNow(tx);
      if (session.endAt > now) throw new ConflictException("SESSION_NOT_ENDED");
      const outcome = await currentOutcome(tx, session);
      if (!outcome) throw new ConflictException("ATTENDANCE_PENDING");
      if (isAbsentCase(outcome.attendanceCase))
        throw new ConflictException("SESSION_ATTENDANCE_NOT_MET");
      if (
        (isTeacher
          ? session.teacherConfirmationStatus
          : session.learnerConfirmationStatus) === "CONFIRMED"
      )
        return { id: sessionId, status: session.status };
      if (session.confirmDeadlineAt && now >= session.confirmDeadlineAt)
        throw new ConflictException("CONFIRM_WINDOW_CLOSED");
      const otherConfirmed =
        (isTeacher
          ? session.learnerConfirmationStatus
          : session.teacherConfirmationStatus) === "CONFIRMED";
      await tx.session.update({
        where: { id: sessionId },
        data: {
          status: "AWAITING_CONFIRMATION",
          ...confirmationData(isTeacher, now, note),
        },
      });
      if (!otherConfirmed)
        return { id: sessionId, status: "AWAITING_CONFIRMATION" as const };
      await completeSession(tx, session, outcome, "COMPLETED_MUTUAL", now);
      return { id: sessionId, status: "COMPLETED" as const };
    });
  }

  settlePath(actor: Principal, pathId: string) {
    return this.observedSettlement(pathId, actor);
  }

  async approveImmediateSettlement(
    actor: Principal,
    pathId: string,
    expectedVersion: number,
  ) {
    const consent = await this.transactions.run(async (tx) => {
      await lockLearningPathLifecycle(
        tx,
        pathId,
        this.requestPaths,
        this.requests,
        actor,
      );
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: pathId },
      });
      if (path.lockedVersion !== expectedVersion)
        throw new ConflictException("STALE_PATH_VERSION");
      const isA = path.participantAId === actor.userId;
      const own = isA
        ? path.participantASettlementApprovedAt
        : path.participantBSettlementApprovedAt;
      if (path.settledAt)
        return {
          approvedAt: own,
          bothApproved: Boolean(
            path.participantASettlementApprovedAt &&
            path.participantBSettlementApprovedAt,
          ),
        };
      const now = await databaseNow(tx);
      await this.assertImmediateSettlementAllowed(tx, path, now);
      const field = isA
        ? "participantASettlementApprovedAt"
        : "participantBSettlementApprovedAt";
      if (!own) {
        await tx.learningPath.update({
          where: { id: pathId },
          data: { [field]: now },
        });
        await this.audit.append(tx, {
          actor: {
            kind: "HUMAN",
            userId: actor.userId,
            roles: roleCodes(actor),
          },
          action: "PATH_SETTLEMENT_CONSENT",
          target: { type: "LEARNING_PATH", id: pathId },
          after: {
            pathVersion: expectedVersion,
            userId: actor.userId,
            approvedAt: now.toISOString(),
          },
          reason: "Participant approved immediate final settlement",
          context: { requestId: randomUUID(), correlationId: randomUUID() },
        });
        // Reuse the registered settlement consumer; a committed consent survives delivery failure.
        await tx.outboxEvent.create({
          data: {
            aggregateType: "LEARNING_PATH",
            aggregateId: pathId,
            version: 1,
            type: "learning-path.sessions-completed",
            payload: { pathId },
            dedupeKey: `path.settlement-consent:${pathId}:${actor.userId}:${now.toISOString()}`,
            correlationId: randomUUID(),
          },
        });
      }
      const partner = isA
        ? path.participantBSettlementApprovedAt
        : path.participantASettlementApprovedAt;
      return { approvedAt: own ?? now, bothApproved: Boolean(partner) };
    });
    // Never hold the consent transaction while starting the financial transaction.
    const settlement = await this.trySettleCompletedPath(pathId).catch(
      (error: unknown) => settlementFailure(error),
    );
    return { pathId, ...consent, settlement };
  }

  private async assertImmediateSettlementAllowed(
    tx: TransactionContext,
    path: LearningPath,
    now: Date,
  ) {
    if (await this.reports.hasBlockingDispute(tx, path.id))
      throw new ConflictException("SETTLEMENT_BLOCKED_BY_DISPUTE");
    if (await pendingTermination(tx, path.id, now))
      throw new ConflictException("SETTLEMENT_BLOCKED_BY_TERMINATION");
    if (path.status !== "ACTIVE")
      throw new ConflictException("LEARNING_PATH_NOT_SETTLEABLE");
    if (
      await tx.session.count({
        where: { pathId: path.id, status: { not: "COMPLETED" } },
      })
    )
      throw new ConflictException("PATH_SESSIONS_INCOMPLETE");
    await this.reports.pathSettlementDeadline(tx, path.id);
  }

  async trySettleCompletedPath(pathId: string) {
    try {
      await this.observedSettlement(pathId);
      return { outcome: "SETTLED" as const };
    } catch (error) {
      if (
        error instanceof ConflictException &&
        [
          "LEARNING_PATH_NOT_SETTLEABLE",
          "PATH_SESSIONS_INCOMPLETE",
          "SETTLEMENT_BLOCKED_BY_DISPUTE",
          "DISPUTE_WINDOW_OPEN",
          "SETTLEMENT_BLOCKED_BY_TERMINATION",
        ].includes(error.message)
      )
        return { outcome: "WAITING" as const };
      throw error;
    }
  }

  private async observedSettlement(pathId: string, actor?: Principal) {
    try {
      const result = await this.settle(pathId, actor);
      await this.recordSettlement(pathId);
      return result;
    } catch (error) {
      if (!(
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ))
        await this.recordSettlement(pathId, error);
      throw error;
    }
  }

  private async recordSettlement(pathId: string, failure?: unknown) {
    await this.transactions
      .run((tx) => recordSettlementAttempt(tx, pathId, failure))
      .catch(() => this.logger.error("SETTLEMENT_DIAGNOSTIC_UNAVAILABLE"));
  }

  private settle(pathId: string, actor?: Principal) {
    return this.transactions.run(async (tx) => {
      const request = await lockLearningPathLifecycle(
        tx,
        pathId,
        this.requestPaths,
        this.requests,
        actor,
      );
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: pathId },
      });
      if (
        actor &&
        actor.userId !== path.participantAId &&
        actor.userId !== path.participantBId
      ) {
        throw new ForbiddenException("LEARNING_PATH_ACCESS_DENIED");
      }
      if (!path.settledAt && path.status !== "ACTIVE")
        throw new ConflictException("LEARNING_PATH_NOT_SETTLEABLE");
      await this.assertSettlementRequest(tx, request, path);
      if (path.settledAt) {
        return {
          pathId,
          status: path.status,
          operationId: path.settlementOperationId,
          gross: creditText(path.settlementGrossAmount),
          fee: creditText(path.settlementFeeAmount),
        };
      }
      const incomplete = await tx.session.count({
        where: { pathId, status: { not: "COMPLETED" } },
      });
      if (incomplete > 0)
        throw new ConflictException("PATH_SESSIONS_INCOMPLETE");
      const lockedVersion = path.lockedVersion;
      if (!lockedVersion)
        throw new ConflictException("LOCKED_PATH_VERSION_MISSING");
      const agreement = await tx.learningPathVersion.findUniqueOrThrow({
        where: { pathId_versionNo: { pathId, versionNo: lockedVersion } },
      });
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (!(clock?.now instanceof Date))
        throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
      if (await pendingTermination(tx, pathId, clock.now))
        throw new ConflictException("SETTLEMENT_BLOCKED_BY_TERMINATION");
      await this.reports.assertPathSettlementAllowed(tx, pathId, clock.now);
      const result = await this.settlement.settlePath(tx, {
        pathId,
        pathVersion: lockedVersion,
        exchangeType: agreement.exchangeType,
        now: clock.now,
      });
      const plans = await tx.pathVersionPlan.findMany({
        where: { pathId, pathVersion: lockedVersion },
        include: { ownedPlanRecord: true, planVersionRecord: true },
      });
      if (plans.length !== 0) {
        // The only unique key is (userId, skillId, sourcePlanId): already-learned rows are kept as-is.
        await tx.userLearnedSkill.createMany({
          data: plans.map((plan) => ({
            userId: plan.ownedPlanRecord.learnerId,
            skillId: plan.planVersionRecord.skillId,
            sourcePathId: pathId,
            sourcePlanId: plan.planId,
            completedAt: clock.now,
            completionRuleVersion: "SRS-1.6",
          })),
          skipDuplicates: true,
        });
      }
      for (const userId of [path.participantAId, path.participantBId].sort(
        byCodeUnit,
      )) {
        await this.reputation.applyPathCompletion(
          tx,
          userId,
          pathId,
          clock.now,
        );
        await this.achievements.evaluate(tx, userId, clock.now);
      }
      if (request !== null)
        await this.requests.markClosed(tx, request.id, request.version);
      return {
        pathId,
        status: "COMPLETED" as const,
        operationId: result.operationId,
        gross: creditText(result.gross),
        fee: creditText(result.fee),
      };
    });
  }

  private async assertSettlementRequest(
    tx: TransactionContext,
    request: Awaited<
      ReturnType<LearningRequestLifecycleService["lockForPath"]>
    > | null,
    path: LearningPath,
  ) {
    if (request !== null) {
      const committed = await this.requestPaths.readCommittedPathIds(
        tx,
        request.id,
      );
      const expectedStatus = path.settledAt ? "CLOSED" : "MATCHED";
      if (
        request.status !== expectedStatus ||
        committed.length !== 1 ||
        committed[0] !== path.id ||
        path.lockedVersion === null
      )
        throw new ConflictException("REQUEST_LIFECYCLE_INCONSISTENT");
    }
  }
}
