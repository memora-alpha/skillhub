import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { TransactionRunner } from "../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../infrastructure/database/transaction-context";
import { byCodeUnit } from "../../infrastructure/idempotency/idempotency.service";
import type { Principal } from "../auth/application/services/sessions.service";
import { CreditLedgerService } from "../credit/credit-ledger.service";
import { ReputationService } from "../reputation/reputation.service";
import { AchievementsService } from "../reputation/achievements.service";
import { ReportsService } from "../reports/reports.service";

/** Credit is stored in hundredths; responses use the same "12.50" form as requests. */
function creditText(units: bigint | null): string | null {
  if (units === null) return null;
  return `${units / 100n}.${String(units % 100n).padStart(2, "0")}`;
}

async function lockSession(tx: TransactionContext, sessionId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT session_id AS id FROM sessions WHERE session_id = ${sessionId}::uuid FOR UPDATE
  `;
  if (rows.length === 0) throw new NotFoundException("SESSION_NOT_FOUND");
}

async function lockPath(tx: TransactionContext, pathId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT path_id AS id FROM learning_paths WHERE path_id = ${pathId}::uuid FOR UPDATE
  `;
  if (rows.length === 0) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
}

@Injectable()
export class LearningSessionsService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly db: PrismaService,
    private readonly creditLedger: CreditLedgerService,
    private readonly reputation: ReputationService,
    private readonly achievements: AchievementsService,
    private readonly reports: ReportsService,
  ) {}

  async mine(actor: Principal, from?: string, to?: string) {
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : undefined;
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
    return sessions.map((session) => ({
      ...session,
      role: actor.userId === session.teacherId ? "TEACHER" : "LEARNER",
    }));
  }

  async detail(actor: Principal, sessionId: string) {
    const session = await this.db.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException("SESSION_NOT_FOUND");
    if (
      actor.userId !== session.teacherId &&
      actor.userId !== session.learnerId
    ) {
      throw new ForbiddenException("SESSION_ACCESS_DENIED");
    }
    return {
      ...session,
      teacherAttendanceSeconds: session.teacherAttendanceSeconds.toString(),
      learnerAttendanceSeconds: session.learnerAttendanceSeconds.toString(),
    };
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
      if (session.status === "CANCELLED" || session.status === "DISPUTED") {
        throw new ConflictException("SESSION_CANNOT_BE_COMPLETED");
      }
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`
        SELECT CURRENT_TIMESTAMP AS now
      `;
      if (!(clock?.now instanceof Date) || session.endAt > clock.now) {
        throw new ConflictException("SESSION_NOT_ENDED");
      }
      const nextTeacherConfirmation = isTeacher
        ? "CONFIRMED"
        : session.teacherConfirmationStatus;
      const nextLearnerConfirmation = isTeacher
        ? session.learnerConfirmationStatus
        : "CONFIRMED";
      const completed =
        nextTeacherConfirmation === "CONFIRMED" &&
        nextLearnerConfirmation === "CONFIRMED";
      await tx.session.update({
        where: { id: sessionId },
        data: {
          status: completed ? "COMPLETED" : "AWAITING_CONFIRMATION",
          ...(isTeacher
            ? {
                teacherConfirmationStatus: "CONFIRMED",
                teacherConfirmedAt: clock.now,
                teacherConfirmationNote: note,
              }
            : {
                learnerConfirmationStatus: "CONFIRMED",
                learnerConfirmedAt: clock.now,
                learnerConfirmationNote: note,
              }),
        },
      });
      if (completed) await this.refreshPathStatus(tx, session.pathId);
      return {
        id: sessionId,
        status: completed ? "COMPLETED" : "AWAITING_CONFIRMATION",
      };
    });
  }

  settlePath(actor: Principal, pathId: string) {
    return this.transactions.run(async (tx) => {
      await lockPath(tx, pathId);
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: pathId },
      });
      if (
        actor.userId !== path.participantAId &&
        actor.userId !== path.participantBId
      ) {
        throw new ForbiddenException("LEARNING_PATH_ACCESS_DENIED");
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
      if (path.status !== "ACTIVE")
        throw new ConflictException("LEARNING_PATH_NOT_SETTLEABLE");
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
      const result = await this.creditLedger.settlePath(tx, {
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
      return {
        pathId,
        status: "COMPLETED" as const,
        operationId: result.operationId,
        gross: creditText(result.gross),
        fee: creditText(result.fee),
      };
    });
  }

  private async refreshPathStatus(tx: TransactionContext, pathId: string) {
    const remaining = await tx.session.count({
      where: { pathId, status: { not: "COMPLETED" } },
    });
    if (remaining === 0) {
      await tx.learningPath.update({
        where: { id: pathId },
        data: { status: "ACTIVE" },
      });
    }
  }
}
