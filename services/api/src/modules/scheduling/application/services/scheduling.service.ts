import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import type { RoleCode } from "../../../../shared/authorization/authorization.types";
import type {
  CreateScheduleProposalDto,
  RescheduleSessionDto,
} from "../../presentation/http/scheduling.dto";

const millisecondsPerMinute = 60_000;

function validateItems(
  items: CreateScheduleProposalDto["items"],
  expectedSessions: number,
  now: Date,
  durationMinutes: { min: number; max: number },
): void {
  if (items.length !== expectedSessions) {
    throw new BadRequestException("SCHEDULE_ITEM_COUNT_MISMATCH");
  }
  const sorted = [...items].sort(
    (left, right) => left.sessionNo - right.sessionNo,
  );
  for (let index = 0; index < sorted.length; index += 1) {
    const item = sorted[index];
    if (!item) throw new BadRequestException("INVALID_SCHEDULE_ITEMS");
    const start = new Date(item.startAt);
    const end = new Date(item.endAt);
    const duration = (end.getTime() - start.getTime()) / millisecondsPerMinute;
    if (
      item.sessionNo !== index + 1 ||
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start <= now ||
      duration < durationMinutes.min ||
      duration > durationMinutes.max
    ) {
      throw new BadRequestException("INVALID_SCHEDULE_ITEMS");
    }
    const previous = sorted[index - 1];
    if (previous && start < new Date(previous.endAt)) {
      throw new BadRequestException("SCHEDULE_ITEMS_OVERLAP");
    }
  }
}

async function lockScheduleProposal(
  tx: TransactionContext,
  scheduleProposalId: string,
) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT schedule_proposal_id AS id
    FROM schedule_proposals
    WHERE schedule_proposal_id = ${scheduleProposalId}::uuid
    FOR UPDATE
  `;
  if (rows.length === 0) throw new NotFoundException("SCHEDULE_NOT_FOUND");
}

async function lockPath(tx: TransactionContext, pathId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT path_id AS id FROM learning_paths WHERE path_id = ${pathId}::uuid FOR UPDATE
  `;
  if (rows.length === 0) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
}

async function lockSession(tx: TransactionContext, sessionId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT session_id AS id FROM sessions WHERE session_id = ${sessionId}::uuid FOR UPDATE
  `;
  if (rows.length === 0) throw new NotFoundException("SESSION_NOT_FOUND");
}

async function applyReschedule(
  tx: TransactionContext,
  scheduleId: string,
  versionNo: number,
  appliedVersion: number,
  now: Date,
  cutoffMinutes: number,
) {
  const previousItems = await tx.scheduleItem.findMany({
    where: { scheduleProposalId: scheduleId, scheduleVersion: appliedVersion },
  });
  const nextItems = await tx.scheduleItem.findMany({
    where: { scheduleProposalId: scheduleId, scheduleVersion: versionNo },
  });
  if (previousItems.length !== nextItems.length) {
    throw new ConflictException("INVALID_RESCHEDULE_VERSION");
  }
  const histories = await tx.sessionScheduleHistory.findMany({
    where: {
      scheduleItemId: { in: previousItems.map(({ id }) => id) },
      supersededAt: null,
    },
    include: { sessionIdRecord: true },
  });
  const historyByItem = new Map(
    histories.map((history) => [history.scheduleItemId, history]),
  );
  const previousBySession = new Map(
    previousItems.map((item) => [
      `${item.planId}:${item.planVersion}:${item.sessionNo}`,
      item,
    ]),
  );
  const updates = nextItems.map((item) => {
    const key = `${item.planId}:${item.planVersion}:${item.sessionNo}`;
    const previous = previousBySession.get(key);
    const history = previous ? historyByItem.get(previous.id) : undefined;
    if (!history)
      throw new ConflictException("SESSION_SCHEDULE_HISTORY_MISSING");
    const session = history.sessionIdRecord;
    const changed =
      session.startAt.getTime() !== item.startAt.getTime() ||
      session.endAt.getTime() !== item.endAt.getTime();
    if (changed) {
      if (
        !["CONFIRMED", "READY"].includes(session.status) ||
        session.startAt.getTime() - now.getTime() <
          cutoffMinutes * millisecondsPerMinute
      ) {
        throw new ConflictException("RESCHEDULE_CUTOFF_OR_STATE_VIOLATION");
      }
    }
    return { item, previousHistory: history, session, changed };
  });
  await tx.sessionScheduleHistory.updateMany({
    where: {
      id: { in: updates.map(({ previousHistory }) => previousHistory.id) },
    },
    data: { supersededAt: now },
  });
  for (const { item, session, changed } of updates) {
    if (changed) {
      await tx.session.update({
        where: { id: session.id },
        data: { startAt: item.startAt, endAt: item.endAt, status: "CONFIRMED" },
      });
    }
  }
  if (updates.length > 0) {
    await tx.sessionScheduleHistory.createMany({
      data: updates.map(({ item, session }) => ({
        id: randomUUID(),
        sessionId: session.id,
        scheduleItemId: item.id,
        appliedAt: now,
      })),
    });
  }
  return updates.filter(({ changed }) => changed);
}

@Injectable()
export class SchedulingService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly configuration: SystemConfigurationService,
  ) {}

  createProposal(
    actor: Principal,
    planId: string,
    input: CreateScheduleProposalDto,
  ) {
    return this.transactions.run(async (tx) => {
      const initialPlan = await tx.learningPlan.findUnique({
        where: { id: planId },
      });
      if (!initialPlan) throw new NotFoundException("LEARNING_PLAN_NOT_FOUND");
      await lockPath(tx, initialPlan.pathId);
      const plan = await tx.learningPlan.findUnique({
        where: { id: planId },
        include: {
          learningPlanVersionPlanIdRecords: {
            where: { versionNo: input.expectedPlanVersion },
          },
        },
      });
      if (!plan) throw new NotFoundException("LEARNING_PLAN_NOT_FOUND");
      if (
        actor.userId !== plan.teacherId ||
        actor.userId !== plan.createdByUserId
      ) {
        throw new ForbiddenException("ONLY_PLAN_TEACHER_CAN_PROPOSE_SCHEDULE");
      }
      if (
        plan.currentVersion !== input.expectedPlanVersion ||
        plan.status !== "CONFIRMED"
      ) {
        throw new ConflictException("LEARNING_PLAN_NOT_CONFIRMED");
      }
      const planVersion = plan.learningPlanVersionPlanIdRecords[0];
      if (!planVersion?.learnerConfirmedAt) {
        throw new ConflictException("LEARNING_PLAN_NOT_CONFIRMED");
      }
      const path = await tx.learningPath.findUnique({
        where: { id: plan.pathId },
      });
      if (path?.status !== "CONFIRMED") {
        throw new ConflictException("LEARNING_PATH_NOT_CONFIRMED");
      }
      const pathVersion = await tx.learningPathVersion.findUnique({
        where: {
          pathId_versionNo: { pathId: path.id, versionNo: path.currentVersion },
        },
      });
      if (!pathVersion)
        throw new ConflictException("LEARNING_PATH_VERSION_MISSING");
      const currentAgreementPlan = await tx.pathVersionPlan.findUnique({
        where: {
          pathId_pathVersion_planId: {
            pathId: path.id,
            pathVersion: path.currentVersion,
            planId,
          },
        },
      });
      if (
        !currentAgreementPlan ||
        currentAgreementPlan.planVersion !== plan.currentVersion
      ) {
        throw new ConflictException("PLAN_NOT_IN_CURRENT_AGREEMENT");
      }
      const existingSchedule = await tx.scheduleVersion.findFirst({
        where: {
          pathId: path.id,
          pathVersion: path.currentVersion,
          scheduleItemScheduleVersionRecords: {
            some: { planId, planVersion: plan.currentVersion },
          },
        },
        select: { scheduleProposalId: true },
      });
      if (existingSchedule) {
        throw new ConflictException("SCHEDULE_PROPOSAL_ALREADY_EXISTS");
      }
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`
        SELECT CURRENT_TIMESTAMP AS now
      `;
      if (!(clock?.now instanceof Date)) {
        throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
      }
      const { values } = await this.configuration.getSnapshot(
        ["session.durationMinutes"],
        tx,
      );
      validateItems(
        input.items,
        planVersion.totalSessions,
        clock.now,
        values["session.durationMinutes"],
      );
      const scheduleId = randomUUID();
      await tx.scheduleProposal.create({
        data: {
          id: scheduleId,
          pathId: path.id,
          currentVersion: 1,
          status: "PROPOSED",
          scheduleVersionProposalRecords: {
            create: {
              versionNo: 1,
              pathVersion: path.currentVersion,
              createdByUserId: actor.userId,
              scheduleItemScheduleVersionRecords: {
                create: input.items.map((item) => ({
                  id: randomUUID(),
                  planId,
                  planVersion: plan.currentVersion,
                  sessionNo: item.sessionNo,
                  startAt: new Date(item.startAt),
                  endAt: new Date(item.endAt),
                })),
              },
            },
          },
        },
      });
      return { id: scheduleId, version: 1, status: "PROPOSED" as const };
    });
  }

  async confirmProposal(
    actor: Principal,
    scheduleId: string,
    expectedVersion: number,
  ) {
    return this.transactions.run(async (tx) => {
      const initial = await tx.scheduleProposal.findUnique({
        where: { id: scheduleId },
        select: { pathId: true },
      });
      if (!initial) throw new NotFoundException("SCHEDULE_NOT_FOUND");
      await lockPath(tx, initial.pathId);
      await lockScheduleProposal(tx, scheduleId);
      const proposal = await tx.scheduleProposal.findUnique({
        where: { id: scheduleId },
        include: { pathIdRecord: true },
      });
      if (!proposal) throw new NotFoundException("SCHEDULE_NOT_FOUND");
      const path = proposal.pathIdRecord;
      if (
        actor.userId !== path.participantAId &&
        actor.userId !== path.participantBId
      ) {
        throw new ForbiddenException("LEARNING_PATH_ACCESS_DENIED");
      }
      if (proposal.status === "LOCKED") {
        throw new ConflictException("SCHEDULE_ALREADY_LOCKED");
      }
      if (proposal.currentVersion !== expectedVersion) {
        throw new ConflictException("STALE_SCHEDULE_VERSION");
      }
      const version = await tx.scheduleVersion.findUniqueOrThrow({
        where: {
          scheduleProposalId_versionNo: {
            scheduleProposalId: scheduleId,
            versionNo: expectedVersion,
          },
        },
      });
      const validateSchedulePath = () => {
        const isReschedule = proposal.appliedVersion !== null;
        if (
          (!isReschedule && path.status !== "CONFIRMED") ||
          (isReschedule &&
            path.status !== "SCHEDULED" &&
            path.status !== "ACTIVE") ||
          version.pathVersion !== path.currentVersion
        ) {
          throw new ConflictException("STALE_LEARNING_PATH_VERSION");
        }
      };
      validateSchedulePath();
      const confirmField =
        actor.userId === path.participantAId
          ? version.participantAConfirmedAt
          : version.participantBConfirmedAt;
      if (!confirmField) {
        await tx.scheduleVersion.update({
          where: {
            scheduleProposalId_versionNo: {
              scheduleProposalId: scheduleId,
              versionNo: expectedVersion,
            },
          },
          data:
            actor.userId === path.participantAId
              ? { participantAConfirmedAt: new Date() }
              : { participantBConfirmedAt: new Date() },
        });
      }
      const refreshed = await tx.scheduleVersion.findUniqueOrThrow({
        where: {
          scheduleProposalId_versionNo: {
            scheduleProposalId: scheduleId,
            versionNo: expectedVersion,
          },
        },
      });
      const bothConfirmed =
        Boolean(refreshed.participantAConfirmedAt) &&
        Boolean(refreshed.participantBConfirmedAt);
      const applyConfirmedReschedule = async () => {
        if (bothConfirmed && proposal.appliedVersion !== null) {
          const [clock] = await tx.$queryRaw<{ now: Date }[]>`
          SELECT CURRENT_TIMESTAMP AS now
        `;
          if (!(clock?.now instanceof Date)) {
            throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
          }
          const { values } = await this.configuration.getSnapshot(
            ["schedule.rescheduleCutoffMinutes"],
            tx,
          );
          const changes = await applyReschedule(
            tx,
            scheduleId,
            expectedVersion,
            proposal.appliedVersion,
            clock.now,
            values["schedule.rescheduleCutoffMinutes"],
          );
          await this.audit.append(tx, {
            actor: {
              kind: "HUMAN",
              userId: actor.userId,
              roles: actor.roles.filter(
                (role): role is RoleCode =>
                  role === "USER" || role === "STAFF" || role === "ADMIN",
              ),
            },
            action: "SCHEDULE_RESCHEDULE",
            target: { type: "SCHEDULE_PROPOSAL", id: scheduleId },
            before: {
              appliedVersion: proposal.appliedVersion,
              sessions: changes.map(({ session }) => ({
                sessionId: session.id,
                startAt: session.startAt.toISOString(),
                endAt: session.endAt.toISOString(),
              })),
            },
            after: {
              appliedVersion: expectedVersion,
              sessions: changes.map(({ item, session }) => ({
                sessionId: session.id,
                startAt: item.startAt.toISOString(),
                endAt: item.endAt.toISOString(),
              })),
            },
            reason: "Reschedule confirmed by both participants",
            context: { requestId: randomUUID(), correlationId: randomUUID() },
          });
        }
      };
      await applyConfirmedReschedule();
      const rescheduleApplied =
        bothConfirmed && proposal.appliedVersion !== null;
      const pendingStatus = bothConfirmed ? "PROPOSED" : "PARTIALLY_CONFIRMED";
      const status = rescheduleApplied ? "LOCKED" : pendingStatus;
      await tx.scheduleProposal.update({
        where: { id: scheduleId },
        data: {
          status,
          ...(rescheduleApplied ? { appliedVersion: expectedVersion } : {}),
        },
      });
      return {
        id: scheduleId,
        version: expectedVersion,
        bothConfirmed,
        status,
      };
    });
  }

  async proposeReschedule(
    actor: Principal,
    sessionId: string,
    input: RescheduleSessionDto,
  ) {
    return this.transactions.run(async (tx) => {
      const session = await tx.session.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException("SESSION_NOT_FOUND");
      if (
        actor.userId !== session.teacherId &&
        actor.userId !== session.learnerId
      ) {
        throw new ForbiddenException("SESSION_ACCESS_DENIED");
      }
      await lockPath(tx, session.pathId);
      await lockSession(tx, sessionId);
      const lockedSession = await tx.session.findUniqueOrThrow({
        where: { id: sessionId },
      });
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: lockedSession.pathId },
      });
      if (
        (path.status !== "SCHEDULED" && path.status !== "ACTIVE") ||
        !["CONFIRMED", "READY"].includes(lockedSession.status)
      ) {
        throw new ConflictException("SESSION_CANNOT_BE_RESCHEDULED");
      }
      const history = await tx.sessionScheduleHistory.findFirst({
        where: { sessionId, supersededAt: null },
        orderBy: { appliedAt: "desc" },
        include: {
          scheduleItemIdRecord: { include: { scheduleVersionRecord: true } },
        },
      });
      if (!history)
        throw new ConflictException("SESSION_SCHEDULE_HISTORY_MISSING");
      const baseVersion = history.scheduleItemIdRecord.scheduleVersionRecord;
      const scheduleId = baseVersion.scheduleProposalId;
      await lockScheduleProposal(tx, scheduleId);
      const proposal = await tx.scheduleProposal.findUniqueOrThrow({
        where: { id: scheduleId },
      });
      if (proposal.appliedVersion !== baseVersion.versionNo) {
        throw new ConflictException("APPLIED_SCHEDULE_VERSION_MISMATCH");
      }
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`
        SELECT CURRENT_TIMESTAMP AS now
      `;
      if (!(clock?.now instanceof Date)) {
        throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
      }
      const { values } = await this.configuration.getSnapshot(
        ["schedule.rescheduleCutoffMinutes", "session.durationMinutes"],
        tx,
      );
      if (
        lockedSession.startAt.getTime() - clock.now.getTime() <
        values["schedule.rescheduleCutoffMinutes"] * millisecondsPerMinute
      ) {
        throw new ConflictException("RESCHEDULE_CUTOFF_VIOLATION");
      }
      const durationMinutes = values["session.durationMinutes"];
      const startAt = new Date(input.startAt);
      const endAt = new Date(input.endAt);
      const duration =
        (endAt.getTime() - startAt.getTime()) / millisecondsPerMinute;
      if (
        !Number.isFinite(startAt.getTime()) ||
        !Number.isFinite(endAt.getTime()) ||
        startAt <= clock.now ||
        duration < durationMinutes.min ||
        duration > durationMinutes.max
      ) {
        throw new BadRequestException("INVALID_SCHEDULE_ITEMS");
      }
      const expectedVersion = input.expectedVersion;
      if (expectedVersion !== proposal.currentVersion) {
        throw new ConflictException("STALE_SCHEDULE_VERSION");
      }
      const currentItems = await tx.scheduleItem.findMany({
        where: {
          scheduleProposalId: scheduleId,
          scheduleVersion: proposal.appliedVersion,
        },
        orderBy: { sessionNo: "asc" },
      });
      const candidateItems = currentItems.map((item) => ({
        ...item,
        startAt: item.id === history.scheduleItemId ? startAt : item.startAt,
        endAt: item.id === history.scheduleItemId ? endAt : item.endAt,
      }));
      const otherSessions = await tx.session.findMany({
        where: {
          id: { not: sessionId },
          status: { not: "CANCELLED" },
          OR: [
            { teacherId: { in: [path.participantAId, path.participantBId] } },
            { learnerId: { in: [path.participantAId, path.participantBId] } },
          ],
        },
        select: { startAt: true, endAt: true },
      });
      if (
        candidateItems.some((item) =>
          otherSessions.some(
            (other) => other.startAt < item.endAt && other.endAt > item.startAt,
          ),
        ) ||
        candidateItems.some((item, index) =>
          candidateItems.some(
            (other, otherIndex) =>
              otherIndex > index &&
              other.startAt < item.endAt &&
              other.endAt > item.startAt,
          ),
        )
      ) {
        throw new ConflictException("SCHEDULE_CONFLICT");
      }
      const nextVersion = proposal.currentVersion + 1;
      await tx.scheduleVersion.create({
        data: {
          scheduleProposalId: scheduleId,
          versionNo: nextVersion,
          pathId: path.id,
          pathVersion: path.lockedVersion!,
          createdByUserId: actor.userId,
        },
      });
      await tx.scheduleItem.createMany({
        data: currentItems.map((item) => ({
          id: randomUUID(),
          scheduleProposalId: scheduleId,
          scheduleVersion: nextVersion,
          planId: item.planId,
          planVersion: item.planVersion,
          sessionNo: item.sessionNo,
          startAt: candidateItems.find(
            (candidate) => candidate.sessionNo === item.sessionNo,
          )!.startAt,
          endAt: candidateItems.find(
            (candidate) => candidate.sessionNo === item.sessionNo,
          )!.endAt,
        })),
      });
      await tx.scheduleProposal.update({
        where: { id: scheduleId },
        data: { currentVersion: nextVersion, status: "NEEDS_REVISION" },
      });
      return {
        id: scheduleId,
        version: nextVersion,
        status: "NEEDS_REVISION" as const,
      };
    });
  }
}
