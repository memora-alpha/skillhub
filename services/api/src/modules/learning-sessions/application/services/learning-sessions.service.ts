import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
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
import type { Session } from "../../../../generated/prisma/client";
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
import { lockUsers } from "../../../../shared/database/identity-transactions";
import { LearningRequestLifecycleService } from "../../../learning-requests/application/services/learning-request-lifecycle.service";
import { LearningRequestPathReader } from "../../../learning-paths/application/services/learning-request-path.reader";
import { lockLearningPath as lockPath } from "../../../learning-paths/application/services/learning-path-lock";

async function lockSession(tx: TransactionContext, sessionId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT session_id AS id FROM sessions WHERE session_id = ${sessionId}::uuid FOR UPDATE
  `;
  if (rows.length === 0) throw new NotFoundException("SESSION_NOT_FOUND");
}

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

@Injectable()
export class LearningSessionsService {
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

  private async lockedSession(tx: TransactionContext, sessionId: string) {
    const initial = await tx.session.findUnique({ where: { id: sessionId } });
    if (!initial) throw new NotFoundException("SESSION_NOT_FOUND");
    await lockPath(tx, initial.pathId);
    await lockSession(tx, sessionId);
    return tx.session.findUniqueOrThrow({ where: { id: sessionId } });
  }

  async issueLiveKitToken(
    actor: Principal,
    sessionId: string,
  ): Promise<LiveKitTokenResponse> {
    if (!actor.permissions.includes("livekit-token:issue:participant"))
      throw new ForbiddenException("SESSION_ACCESS_DENIED");
    return this.transactions.run(async (tx) => {
      const session = await this.lockedSession(tx, sessionId);
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
      if (!session.roomName)
        await tx.session.update({
          where: { id: session.id },
          data: { roomName },
        });
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

  async mine(actor: Principal, from?: string, to?: string) {
    let start: Date;
    let end: Date | undefined;
    try {
      start = from ? parseAbsoluteTimestamp(from) : this.clock.now();
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
        ...(end
          ? { startAt: { gte: start, lte: end } }
          : { endAt: { gte: start } }),
      },
      orderBy: [{ startAt: "asc" }, { id: "asc" }],
      take: 100,
      select: {
        id: true,
        pathId: true,
        planId: true,
        teacherId: true,
        learnerId: true,
        startAt: true,
        endAt: true,
        status: true,
        teacherConfirmationStatus: true,
        learnerConfirmationStatus: true,
      },
    });
    const policy = await this.joinPolicy();
    const now = this.clock.now();
    return sessions.map((session) => ({
      ...session,
      status: sessionStatusAt(session, now, policy),
      join: sessionJoinAccess(
        session,
        now,
        policy,
        this.livekit.config.enabled,
      ),
      role: actor.userId === session.teacherId ? "TEACHER" : "LEARNER",
    }));
  }

  async detail(actor: Principal, sessionId: string) {
    const session = await this.db.session.findUnique({
      where: { id: sessionId },
      select: sessionReadSelect,
    });
    if (!session) throw new NotFoundException("SESSION_NOT_FOUND");
    this.assertParticipant(actor, session);
    const policy = await this.joinPolicy();
    const now = this.clock.now();
    return {
      ...session,
      status: sessionStatusAt(session, now, policy),
      role: actor.userId === session.teacherId ? "TEACHER" : "LEARNER",
      join: sessionJoinAccess(
        session,
        now,
        policy,
        this.livekit.config.enabled,
      ),
      progress: await this.progress(session.pathId, session.planId),
      attendanceStatus: "UNAVAILABLE" as const,
      teacherAttendanceSeconds: session.teacherAttendanceSeconds.toString(),
      learnerAttendanceSeconds: session.learnerAttendanceSeconds.toString(),
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
    if (
      !event.room?.name ||
      !["participant_joined", "participant_left"].includes(event.event)
    )
      return;
    const initial = await tx.session.findUnique({
      where: { roomName: event.room.name },
    });
    if (!initial) return;
    const session = await this.lockedSession(tx, initial.id);
    const path = await tx.learningPath.findUniqueOrThrow({
      where: { id: session.pathId },
    });
    if (
      !["SCHEDULED", "ACTIVE"].includes(path.status) ||
      ["CANCELLED", "COMPLETED", "DISPUTED"].includes(session.status)
    )
      return;
    if (
      !event.room.sid ||
      (session.providerRoomId && session.providerRoomId !== event.room.sid)
    )
      return;
    const isTeacher =
      event.participant?.identity ===
      sessionParticipantIdentity(session.id, session.teacherId);
    const isLearner =
      event.participant?.identity ===
      sessionParticipantIdentity(session.id, session.learnerId);
    if (!isTeacher && !isLearner) return;
    const [clock] = await tx.$queryRaw<
      { now: Date }[]
    >`SELECT CURRENT_TIMESTAMP AS now`;
    if (!(clock?.now instanceof Date))
      throw new ServiceUnavailableException("DATABASE_TIME_UNAVAILABLE");
    const policy = await this.joinPolicy(tx);
    if (!policy) return;
    const providerAt = new Date(Number(event.createdAt) * 1000);
    // Bound provider clock skew; join windows and state transitions still use DB time.
    const occurredAt = new Date(Math.min(+providerAt, +clock.now));
    const schedule = await tx.sessionScheduleHistory.findFirst({
      where: { sessionId: session.id, supersededAt: null },
      orderBy: { appliedAt: "desc" },
    });
    // Provider createdAt has whole-second precision, including events in the apply second.
    if (schedule && +providerAt < Math.floor(+schedule.appliedAt / 1000) * 1000)
      return;
    const window = sessionJoinAccess(session, occurredAt, policy, true);
    if (!Number.isFinite(+occurredAt) || !window.canJoin) return;
    // Roll back the receipt so provider clock skew cannot permanently discard activity.
    if (+providerAt - +clock.now > 5000)
      throw new ServiceUnavailableException("LIVEKIT_EVENT_NOT_YET_CURRENT");
    const joined = event.event === "participant_joined";
    let status = sessionStatusAt(session, clock.now, policy);
    if (joined && occurredAt >= session.startAt && clock.now < session.endAt)
      status = "ONGOING";
    const data = {
      status,
      providerRoomId: event.room.sid,
      ...participantActivityData(session, isTeacher, joined, occurredAt),
    } as import("../../../../generated/prisma/client").Prisma.SessionUpdateInput;
    await tx.session.update({ where: { id: session.id }, data });
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
      const session = await this.lockedSession(tx, expected.id);
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
        ["CANCELLED", "COMPLETED", "DISPUTED"].includes(session.status)
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

  complete(actor: Principal, sessionId: string, note: string) {
    return this.transactions.run(async (tx) => {
      const initial = await tx.session.findUnique({ where: { id: sessionId } });
      if (!initial) throw new NotFoundException("SESSION_NOT_FOUND");
      await lockPath(tx, initial.pathId);
      await lockSession(tx, sessionId);
      const session = await tx.session.findUniqueOrThrow({
        where: { id: sessionId },
      });
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: session.pathId },
      });
      if (path.status === "DISPUTED")
        throw new ConflictException("SESSION_BLOCKED_BY_DISPUTE");
      const isTeacher = actor.userId === session.teacherId;
      if (!isTeacher && actor.userId !== session.learnerId) {
        throw new ForbiddenException("SESSION_ACCESS_DENIED");
      }
      if (session.status === "COMPLETED") {
        return { id: sessionId, status: session.status };
      }
      if (["CANCELLED", "DISPUTED"].includes(session.status)) {
        throw new ConflictException("SESSION_CANNOT_BE_COMPLETED");
      }
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`
        SELECT CURRENT_TIMESTAMP AS now
      `;
      if (!(clock?.now instanceof Date) || session.endAt > clock.now) {
        throw new ConflictException("SESSION_NOT_ENDED");
      }
      if (
        (isTeacher
          ? session.teacherConfirmationStatus
          : session.learnerConfirmationStatus) === "CONFIRMED"
      )
        return { id: sessionId, status: session.status };
      const nextTeacherConfirmation = isTeacher
        ? "CONFIRMED"
        : session.teacherConfirmationStatus;
      const nextLearnerConfirmation = isTeacher
        ? session.learnerConfirmationStatus
        : "CONFIRMED";
      const completed =
        nextTeacherConfirmation === "CONFIRMED" &&
        nextLearnerConfirmation === "CONFIRMED";
      const status = completed ? "COMPLETED" : "AWAITING_CONFIRMATION";
      await tx.session.update({
        where: { id: sessionId },
        data: { status, ...confirmationData(isTeacher, clock.now, note) },
      });
      if (completed) await this.refreshPathStatus(tx, session.pathId);
      return { id: sessionId, status };
    });
  }

  settlePath(actor: Principal, pathId: string) {
    return this.settle(pathId, actor);
  }

  async trySettleCompletedPath(pathId: string) {
    try {
      await this.settle(pathId);
      return { outcome: "SETTLED" as const };
    } catch (error) {
      if (
        error instanceof ConflictException &&
        [
          "LEARNING_PATH_NOT_SETTLEABLE",
          "PATH_SESSIONS_INCOMPLETE",
          "SETTLEMENT_BLOCKED_BY_DISPUTE",
          "DISPUTE_WINDOW_OPEN",
        ].includes(error.message)
      )
        return { outcome: "WAITING" as const };
      throw error;
    }
  }

  private settle(pathId: string, actor?: Principal) {
    return this.transactions.run(async (tx) => {
      const request = await this.lockSettlementContext(tx, pathId, actor);
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
      if (request !== null) {
        const committed = await this.requestPaths.readCommittedPathIds(
          tx,
          request.id,
        );
        const expectedStatus = path.settledAt ? "CLOSED" : "MATCHED";
        if (
          request.status !== expectedStatus ||
          committed.length !== 1 ||
          committed[0] !== pathId ||
          path.lockedVersion === null
        )
          throw new ConflictException("REQUEST_LIFECYCLE_INCONSISTENT");
      }
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

  private async lockSettlementContext(
    tx: TransactionContext,
    pathId: string,
    actor?: Principal,
  ) {
    const path = await tx.learningPath.findUnique({ where: { id: pathId } });
    if (!path) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
    if (
      actor &&
      actor.userId !== path.participantAId &&
      actor.userId !== path.participantBId
    )
      throw new ForbiddenException("LEARNING_PATH_ACCESS_DENIED");
    const source = await this.requestPaths.readPathSource(tx, pathId);
    await lockUsers(tx, [source.participantAId, source.participantBId]);
    const request =
      source.requestId === null
        ? null
        : await this.requests.lockForPath(tx, source.requestId);
    await lockPath(tx, pathId);
    const lockedSource = await this.requestPaths.readPathSource(tx, pathId);
    if (!isDeepStrictEqual(source, lockedSource))
      throw new ConflictException("REQUEST_LIFECYCLE_INCONSISTENT");
    return request;
  }

  private async refreshPathStatus(tx: TransactionContext, pathId: string) {
    const remaining = await tx.session.count({
      where: { pathId, status: { not: "COMPLETED" } },
    });
    if (remaining === 0) {
      const path = await tx.learningPath.update({
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
  }
}
