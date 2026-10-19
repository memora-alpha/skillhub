import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { TransactionRunner } from "../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../infrastructure/database/transaction-context";
import type { Principal } from "../auth/application/services/sessions.service";
import { ConversationMembershipReader } from "../conversations/conversation-membership.reader";
import { CreditWalletReader } from "../credit/credit-wallet.reader";
import { CreditLedgerService } from "../credit/credit-ledger.service";
import type {
  ChangeLearningPathDto,
  CreateLearningPathDto,
  CreateLearningPlanDto,
} from "./learning-paths.dto";

function creditUnits(value: string): bigint {
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value)) {
    throw new BadRequestException("INVALID_CREDIT_AMOUNT");
  }
  const decimalPoint = value.indexOf(".");
  const whole = decimalPoint < 0 ? value : value.slice(0, decimalPoint);
  const fraction = decimalPoint < 0 ? "" : value.slice(decimalPoint + 1);
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

async function lockPath(tx: TransactionContext, pathId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT path_id AS id FROM learning_paths WHERE path_id = ${pathId}::uuid FOR UPDATE
  `;
  if (rows.length === 0) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
}

async function refreshPathConfirmation(
  tx: TransactionContext,
  pathId: string,
): Promise<void> {
  const path = await tx.learningPath.findUnique({ where: { id: pathId } });
  if (!path) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
  const version = await tx.learningPathVersion.findUnique({
    where: { pathId_versionNo: { pathId, versionNo: path.currentVersion } },
  });
  if (!version) throw new ConflictException("LEARNING_PATH_VERSION_MISSING");
  const plans = await tx.pathVersionPlan.findMany({
    where: { pathId, pathVersion: path.currentVersion },
    include: { ownedPlanRecord: true, planVersionRecord: true },
  });
  const currentPlans = plans;
  const requiredPlanCount = version.exchangeType === "TWO_WAY" ? 2 : 1;
  const directionsValid =
    currentPlans.length === requiredPlanCount &&
    (version.exchangeType === "ONE_WAY"
      ? currentPlans[0]?.ownedPlanRecord.teacherId === version.teacherId &&
        currentPlans[0]?.ownedPlanRecord.learnerId === version.learnerId
      : currentPlans.some(
          ({ ownedPlanRecord }) =>
            ownedPlanRecord.teacherId === path.participantAId &&
            ownedPlanRecord.learnerId === path.participantBId,
        ) &&
        currentPlans.some(
          ({ ownedPlanRecord }) =>
            ownedPlanRecord.teacherId === path.participantBId &&
            ownedPlanRecord.learnerId === path.participantAId,
        ));
  const plansConfirmed =
    directionsValid &&
    currentPlans.every(({ planVersionRecord }) =>
      Boolean(planVersionRecord.learnerConfirmedAt),
    );
  const agreementConfirmed =
    Boolean(version.participantAConfirmedAt) &&
    Boolean(version.participantBConfirmedAt);
  const partialStatus =
    plansConfirmed || agreementConfirmed ? "PARTIALLY_CONFIRMED" : "PROPOSED";
  const status =
    plansConfirmed && agreementConfirmed ? "CONFIRMED" : partialStatus;
  await tx.learningPath.update({ where: { id: pathId }, data: { status } });
}

@Injectable()
export class LearningPathsService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly conversations: ConversationMembershipReader,
    private readonly wallets: CreditWalletReader,
    private readonly creditLedger: CreditLedgerService,
  ) {}

  create(actor: Principal, input: CreateLearningPathDto) {
    const creditInput =
      input.exchangeType === "ONE_WAY"
        ? input.negotiatedCredit
        : input.totalCreditPerUser;
    if (!creditInput) throw new BadRequestException("INVALID_CREDIT_AMOUNT");
    const credit = creditUnits(creditInput);
    if (
      credit <= 0n ||
      (input.exchangeType === "ONE_WAY" &&
        (!input.teacherId ||
          !input.learnerId ||
          input.teacherId === input.learnerId))
    ) {
      throw new BadRequestException("INVALID_LEARNING_AGREEMENT");
    }
    return this.transactions.run(async (tx) => {
      const conversation = await this.conversations.readParticipants(
        tx,
        input.conversationId,
      );
      if (!conversation) throw new NotFoundException("CONVERSATION_NOT_FOUND");
      const participants = new Set([
        conversation.participantAId,
        conversation.participantBId,
      ]);
      if (!participants.has(actor.userId)) {
        throw new ForbiddenException("CONVERSATION_ACCESS_DENIED");
      }
      if (
        input.exchangeType === "ONE_WAY" &&
        (!participants.has(input.teacherId!) ||
          !participants.has(input.learnerId!))
      ) {
        throw new BadRequestException("INVALID_LEARNING_AGREEMENT");
      }
      const pathId = randomUUID();
      await tx.learningPath.create({
        data: {
          id: pathId,
          conversationId: input.conversationId,
          participantAId: conversation.participantAId,
          participantBId: conversation.participantBId,
          currentVersion: 1,
          status: "PROPOSED",
          learningPathVersionPathIdRecords: {
            create: {
              versionNo: 1,
              exchangeType: input.exchangeType,
              negotiatedCredit:
                input.exchangeType === "ONE_WAY" ? credit : null,
              totalCreditPerUser:
                input.exchangeType === "TWO_WAY" ? credit : null,
              teacherId:
                input.exchangeType === "ONE_WAY" ? input.teacherId! : null,
              learnerId:
                input.exchangeType === "ONE_WAY" ? input.learnerId! : null,
              createdByUserId: actor.userId,
            },
          },
        },
        select: { id: true, currentVersion: true, status: true },
      });
      return { id: pathId, version: 1, status: "PROPOSED" as const };
    });
  }

  async reviseAgreement(
    actor: Principal,
    pathId: string,
    input: ChangeLearningPathDto,
  ) {
    const amountText =
      input.exchangeType === "ONE_WAY"
        ? input.negotiatedCredit
        : input.totalCreditPerUser;
    if (!amountText) throw new BadRequestException("INVALID_CREDIT_AMOUNT");
    const amount = creditUnits(amountText);
    if (
      amount <= 0n ||
      (input.exchangeType === "ONE_WAY" &&
        (!input.teacherId ||
          !input.learnerId ||
          input.teacherId === input.learnerId))
    ) {
      throw new BadRequestException("INVALID_LEARNING_AGREEMENT");
    }
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
      if (path.status !== "PROPOSED" && path.status !== "PARTIALLY_CONFIRMED") {
        throw new ConflictException("LEARNING_PATH_NOT_EDITABLE");
      }
      if (path.currentVersion !== input.expectedVersion) {
        throw new ConflictException("STALE_LEARNING_PATH_VERSION");
      }
      if (
        input.exchangeType === "ONE_WAY" &&
        (![path.participantAId, path.participantBId].includes(
          input.teacherId!,
        ) ||
          ![path.participantAId, path.participantBId].includes(
            input.learnerId!,
          ))
      ) {
        throw new BadRequestException("INVALID_LEARNING_AGREEMENT");
      }
      const previous = await tx.learningPathVersion.findUniqueOrThrow({
        where: {
          pathId_versionNo: { pathId, versionNo: path.currentVersion },
        },
      });
      const nextVersion = path.currentVersion + 1;
      await tx.learningPathVersion.create({
        data: {
          pathId,
          versionNo: nextVersion,
          exchangeType: input.exchangeType,
          totalCreditPerUser: input.exchangeType === "TWO_WAY" ? amount : null,
          negotiatedCredit: input.exchangeType === "ONE_WAY" ? amount : null,
          teacherId: input.exchangeType === "ONE_WAY" ? input.teacherId! : null,
          learnerId: input.exchangeType === "ONE_WAY" ? input.learnerId! : null,
          createdByUserId: actor.userId,
        },
      });
      await tx.learningPath.update({
        where: { id: pathId },
        data: { currentVersion: nextVersion, status: "PROPOSED" },
      });
      const plans = await tx.learningPlan.findMany({ where: { pathId } });
      const matchingPlans = plans.filter((plan) =>
        input.exchangeType === "ONE_WAY"
          ? plan.teacherId === input.teacherId &&
            plan.learnerId === input.learnerId
          : (plan.teacherId === path.participantAId &&
              plan.learnerId === path.participantBId) ||
            (plan.teacherId === path.participantBId &&
              plan.learnerId === path.participantAId),
      );
      if (matchingPlans.length !== 0) {
        await tx.pathVersionPlan.createMany({
          data: matchingPlans.map((plan) => ({
            pathId,
            pathVersion: nextVersion,
            planId: plan.id,
            planVersion: plan.currentVersion,
          })),
        });
      }
      await refreshPathConfirmation(tx, pathId);
      return {
        id: pathId,
        version: nextVersion,
        previousExchangeType: previous.exchangeType,
        exchangeType: input.exchangeType,
        status: "PROPOSED" as const,
      };
    });
  }

  async addPlan(
    actor: Principal,
    pathId: string,
    input: CreateLearningPlanDto,
  ) {
    if (input.sessionOutline.length !== input.totalSessions) {
      throw new BadRequestException("SESSION_OUTLINE_COUNT_MISMATCH");
    }
    return this.transactions.run(async (tx) => {
      await lockPath(tx, pathId);
      const path = await tx.learningPath.findUnique({ where: { id: pathId } });
      if (
        !path ||
        (path.status !== "PROPOSED" && path.status !== "PARTIALLY_CONFIRMED")
      ) {
        throw new ConflictException("LEARNING_PATH_NOT_EDITABLE");
      }
      const version = await tx.learningPathVersion.findUnique({
        where: { pathId_versionNo: { pathId, versionNo: path.currentVersion } },
      });
      if (!version)
        throw new ConflictException("LEARNING_PATH_VERSION_MISSING");
      if (version.exchangeType === "ONE_WAY") {
        if (actor.userId !== version.teacherId || !version.learnerId) {
          throw new ForbiddenException("ONLY_TEACHER_CAN_CREATE_PLAN");
        }
      } else if (
        actor.userId !== path.participantAId &&
        actor.userId !== path.participantBId
      ) {
        throw new ForbiddenException("LEARNING_PATH_ACCESS_DENIED");
      }
      const teacherId = actor.userId;
      const counterpartId =
        actor.userId === path.participantAId
          ? path.participantBId
          : path.participantAId;
      const learnerId =
        version.exchangeType === "ONE_WAY" ? version.learnerId! : counterpartId;
      const existingCount = await tx.pathVersionPlan.count({
        where: { pathId, pathVersion: path.currentVersion },
      });
      const expectedCount = version.exchangeType === "TWO_WAY" ? 2 : 1;
      if (existingCount >= expectedCount) {
        throw new ConflictException("LEARNING_PLAN_LIMIT_REACHED");
      }
      const existingDirection = await tx.learningPlan.findUnique({
        where: {
          pathId_teacherId_learnerId: { pathId, teacherId, learnerId },
        },
        select: { id: true },
      });
      if (existingDirection) {
        throw new ConflictException("LEARNING_PLAN_DIRECTION_ALREADY_EXISTS");
      }
      const planId = randomUUID();
      await tx.learningPlan.create({
        data: {
          id: planId,
          pathId,
          teacherId,
          learnerId,
          createdByUserId: actor.userId,
          currentVersion: 1,
          status: "PROPOSED",
          learningPlanVersionPlanIdRecords: {
            create: {
              versionNo: 1,
              skillId: input.skillId,
              learningGoal: input.learningGoal,
              totalSessions: input.totalSessions,
              planSessionOutlinePlanVersionRecords: {
                create: input.sessionOutline.map((item, index) => ({
                  sessionNo: index + 1,
                  content: item.content,
                })),
              },
            },
          },
        },
      });
      await tx.pathVersionPlan.create({
        data: {
          pathId,
          pathVersion: path.currentVersion,
          planId,
          planVersion: 1,
        },
      });
      return {
        id: planId,
        version: 1,
        teacherId,
        learnerId,
        status: "PROPOSED" as const,
      };
    });
  }

  async confirmAgreement(
    actor: Principal,
    pathId: string,
    expectedVersion: number,
  ) {
    return this.transactions.run(async (tx) => {
      await lockPath(tx, pathId);
      const path = await tx.learningPath.findUnique({ where: { id: pathId } });
      if (!path) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
      if (
        actor.userId !== path.participantAId &&
        actor.userId !== path.participantBId
      ) {
        throw new ForbiddenException("LEARNING_PATH_ACCESS_DENIED");
      }
      if (expectedVersion !== path.currentVersion) {
        throw new ConflictException("STALE_LEARNING_PATH_VERSION");
      }
      const where = {
        pathId_versionNo: { pathId, versionNo: expectedVersion },
      };
      const currentVersion = await tx.learningPathVersion.findUniqueOrThrow({
        where,
      });
      const confirmationField =
        actor.userId === path.participantAId
          ? currentVersion.participantAConfirmedAt
          : currentVersion.participantBConfirmedAt;
      if (!confirmationField) {
        await tx.learningPathVersion.update({
          where,
          data:
            actor.userId === path.participantAId
              ? { participantAConfirmedAt: new Date() }
              : { participantBConfirmedAt: new Date() },
        });
      }
      await refreshPathConfirmation(tx, pathId);
      return tx.learningPath.findUniqueOrThrow({
        where: { id: pathId },
        select: { id: true, currentVersion: true, status: true },
      });
    });
  }

  async validateForFinalize(actor: Principal, pathId: string) {
    return this.transactions.run((tx) =>
      this.validateForFinalizeTx(tx, actor, pathId),
    );
  }

  private async validateForFinalizeTx(
    tx: TransactionContext,
    actor: Principal,
    pathId: string,
  ) {
    const path = await tx.learningPath.findUnique({ where: { id: pathId } });
    if (!path) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
    if (
      actor.userId !== path.participantAId &&
      actor.userId !== path.participantBId
    ) {
      throw new ForbiddenException("LEARNING_PATH_ACCESS_DENIED");
    }
    const agreement = await tx.learningPathVersion.findUnique({
      where: {
        pathId_versionNo: { pathId, versionNo: path.currentVersion },
      },
    });
    if (!agreement)
      throw new ConflictException("LEARNING_PATH_VERSION_MISSING");
    if (path.status !== "CONFIRMED") {
      throw new ConflictException("LEARNING_PATH_NOT_CONFIRMED");
    }
    if (
      !agreement.participantAConfirmedAt ||
      !agreement.participantBConfirmedAt
    ) {
      throw new ConflictException("LEARNING_PATH_NOT_CONFIRMED");
    }
    const plans = await tx.pathVersionPlan.findMany({
      where: { pathId, pathVersion: path.currentVersion },
      include: { ownedPlanRecord: true, planVersionRecord: true },
    });
    const expectedPlanCount = agreement.exchangeType === "TWO_WAY" ? 2 : 1;
    if (plans.length !== expectedPlanCount) {
      throw new ConflictException("REQUIRED_LEARNING_PLANS_MISSING");
    }
    const validateAgreementPlans = () => {
      for (const link of plans) {
        if (!link.planVersionRecord.learnerConfirmedAt) {
          throw new ConflictException("LEARNING_PLAN_NOT_CONFIRMED");
        }
        if (
          link.ownedPlanRecord.currentVersion !== link.planVersion ||
          link.ownedPlanRecord.status !== "CONFIRMED"
        ) {
          throw new ConflictException("STALE_LEARNING_PLAN_VERSION");
        }
      }
      if (agreement.exchangeType === "TWO_WAY") {
        const aToB = plans.some(
          ({ ownedPlanRecord }) =>
            ownedPlanRecord.teacherId === path.participantAId &&
            ownedPlanRecord.learnerId === path.participantBId,
        );
        const bToA = plans.some(
          ({ ownedPlanRecord }) =>
            ownedPlanRecord.teacherId === path.participantBId &&
            ownedPlanRecord.learnerId === path.participantAId,
        );
        if (!aToB || !bToA || (agreement.totalCreditPerUser ?? 0n) < 2000n) {
          throw new ConflictException("INVALID_TWO_WAY_AGREEMENT");
        }
      } else if (
        !agreement.teacherId ||
        !agreement.learnerId ||
        (agreement.negotiatedCredit ?? 0n) <= 0n ||
        plans[0]?.ownedPlanRecord.teacherId !== agreement.teacherId ||
        plans[0]?.ownedPlanRecord.learnerId !== agreement.learnerId
      ) {
        throw new ConflictException("INVALID_ONE_WAY_AGREEMENT");
      }
    };
    validateAgreementPlans();
    const scheduleVersions = await tx.scheduleVersion.findMany({
      where: { pathId, pathVersion: path.currentVersion },
      include: {
        proposalRecord: true,
        scheduleItemScheduleVersionRecords: true,
      },
    });
    const currentSchedules = scheduleVersions.filter(
      (schedule) =>
        schedule.proposalRecord.currentVersion === schedule.versionNo &&
        schedule.proposalRecord.status === "PROPOSED",
    );
    if (currentSchedules.length !== expectedPlanCount) {
      throw new ConflictException("REQUIRED_SCHEDULE_PROPOSAL_MISSING");
    }
    const collectScheduleItems = () => {
      const scheduleItems =
        [] as (typeof currentSchedules)[number]["scheduleItemScheduleVersionRecords"];
      for (const link of plans) {
        const schedules = currentSchedules.filter((schedule) =>
          schedule.scheduleItemScheduleVersionRecords.some(
            (item) =>
              item.planId === link.planId &&
              item.planVersion === link.planVersion,
          ),
        );
        if (schedules.length !== 1) {
          throw new ConflictException("REQUIRED_SCHEDULE_PROPOSAL_MISSING");
        }
        const schedule = schedules[0];
        if (!schedule) {
          throw new ConflictException("REQUIRED_SCHEDULE_PROPOSAL_MISSING");
        }
        if (
          !schedule.participantAConfirmedAt ||
          !schedule.participantBConfirmedAt ||
          schedule.scheduleItemScheduleVersionRecords.length !==
            link.planVersionRecord.totalSessions
        ) {
          throw new ConflictException("SCHEDULE_NOT_CONFIRMED");
        }
        scheduleItems.push(...schedule.scheduleItemScheduleVersionRecords);
      }

      return scheduleItems;
    };
    const scheduleItems = collectScheduleItems();
    const orderedItems = [...scheduleItems].sort(
      (left, right) => left.startAt.getTime() - right.startAt.getTime(),
    );
    const [clock] = await tx.$queryRaw<{ now: Date }[]>`
        SELECT CURRENT_TIMESTAMP AS now
      `;
    if (!(clock?.now instanceof Date)) {
      throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
    }
    const validateScheduleTimes = () => {
      if (
        orderedItems.some((item) => {
          const duration =
            (item.endAt.getTime() - item.startAt.getTime()) / 60_000;
          return item.startAt <= clock.now || duration < 60 || duration > 180;
        })
      ) {
        throw new ConflictException("INVALID_SCHEDULE_ITEMS");
      }
      for (let index = 1; index < orderedItems.length; index += 1) {
        const current = orderedItems[index];
        const previous = orderedItems[index - 1];
        if (!current || !previous) {
          throw new ConflictException("INVALID_SCHEDULE_ITEMS");
        }
        if (current.startAt < previous.endAt) {
          throw new ConflictException("SCHEDULE_CONFLICT");
        }
      }
    };
    validateScheduleTimes();
    const existingSessions = await tx.session.findMany({
      where: {
        pathId: { not: pathId },
        status: { not: "CANCELLED" },
        OR: [
          { teacherId: { in: [path.participantAId, path.participantBId] } },
          { learnerId: { in: [path.participantAId, path.participantBId] } },
        ],
      },
      select: { startAt: true, endAt: true },
    });
    if (
      orderedItems.some((item) =>
        existingSessions.some(
          (session) =>
            session.startAt < item.endAt && session.endAt > item.startAt,
        ),
      )
    ) {
      throw new ConflictException("SCHEDULE_CONFLICT");
    }
    const payerIds =
      agreement.exchangeType === "TWO_WAY"
        ? [path.participantAId, path.participantBId]
        : [agreement.learnerId!];
    const balances = await this.wallets.balances(tx, payerIds);
    const required =
      agreement.exchangeType === "TWO_WAY"
        ? agreement.totalCreditPerUser!
        : agreement.negotiatedCredit!;
    if (
      payerIds.some((userId) => {
        const balance = balances.find((entry) => entry.userId === userId);
        return !balance || balance.availableCredit < required;
      })
    ) {
      throw new ConflictException("INSUFFICIENT_AVAILABLE_CREDIT");
    }
    return {
      pathId,
      version: path.currentVersion,
      exchangeType: agreement.exchangeType,
      planCount: plans.length,
      scheduleCount: currentSchedules.length,
      ready: true,
    };
  }

  async finalize(actor: Principal, pathId: string, expectedVersion: number) {
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
      if (
        path.status === "SCHEDULED" ||
        path.status === "ACTIVE" ||
        path.status === "COMPLETED"
      ) {
        if (path.lockedVersion !== expectedVersion) {
          throw new ConflictException("STALE_LEARNING_PATH_VERSION");
        }
        const sessions = await tx.session.findMany({
          where: { pathId },
          orderBy: [{ planId: "asc" }, { outlineSessionNo: "asc" }],
          select: {
            id: true,
            planId: true,
            startAt: true,
            endAt: true,
            status: true,
          },
        });
        return {
          pathId,
          version: expectedVersion,
          sessions,
          status: path.status,
        };
      }
      const validation = await this.validateForFinalizeTx(tx, actor, pathId);
      if (validation.version !== expectedVersion) {
        throw new ConflictException("STALE_LEARNING_PATH_VERSION");
      }
      const agreement = await tx.learningPathVersion.findUniqueOrThrow({
        where: {
          pathId_versionNo: { pathId, versionNo: expectedVersion },
        },
      });
      const pathPlans = await tx.pathVersionPlan.findMany({
        where: { pathId, pathVersion: expectedVersion },
        include: { ownedPlanRecord: true },
      });
      const schedules = await tx.scheduleVersion.findMany({
        where: { pathId, pathVersion: expectedVersion },
        include: {
          proposalRecord: true,
          scheduleItemScheduleVersionRecords: true,
        },
      });
      const currentSchedules = schedules.filter(
        (schedule) =>
          schedule.proposalRecord.currentVersion === schedule.versionNo &&
          schedule.proposalRecord.status === "PROPOSED",
      );
      const sessionIds: string[] = [];
      const sessionEntries = currentSchedules.flatMap((schedule) =>
        schedule.scheduleItemScheduleVersionRecords.map((item) => {
          const plan = pathPlans.find(({ planId }) => planId === item.planId);
          if (!plan || plan.planVersion !== item.planVersion) {
            throw new ConflictException("STALE_LEARNING_PLAN_VERSION");
          }
          const id = randomUUID();
          sessionIds.push(id);
          return {
            scheduleItemId: item.id,
            id,
            pathId,
            planId: plan.planId,
            planVersion: plan.planVersion,
            outlineSessionNo: item.sessionNo,
            teacherId: plan.ownedPlanRecord.teacherId,
            learnerId: plan.ownedPlanRecord.learnerId,
            startAt: item.startAt,
            endAt: item.endAt,
            status: "CONFIRMED" as const,
          };
        }),
      );
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`
        SELECT CURRENT_TIMESTAMP AS now
      `;
      if (!(clock?.now instanceof Date)) {
        throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
      }
      const feePolicy = await tx.feePolicyVersion.findFirst({
        where: {
          policyCode: agreement.exchangeType,
          status: "APPROVED",
          approvedAt: { not: null },
          effectiveAt: { lte: clock.now },
        },
        orderBy: [{ effectiveAt: "desc" }, { versionNo: "desc" }],
      });
      if (!feePolicy)
        throw new ConflictException("APPROVED_FEE_POLICY_REQUIRED");
      const feeRule = feePolicy.calculationRule as {
        returnedBps?: unknown;
        feeBps?: unknown;
      };
      const roundingRule = feePolicy.roundingRule as {
        mode?: unknown;
        precision?: unknown;
      };
      if (
        feeRule.returnedBps !== 9600 ||
        feeRule.feeBps !== 400 ||
        roundingRule.mode !== "DOWN" ||
        roundingRule.precision !== 2
      ) {
        throw new ConflictException("UNSUPPORTED_FEE_POLICY");
      }
      const payerCount = agreement.exchangeType === "TWO_WAY" ? 2n : 1n;
      const grossPerPayer =
        agreement.exchangeType === "TWO_WAY"
          ? agreement.totalCreditPerUser!
          : agreement.negotiatedCredit!;
      const feeSnapshot = ((grossPerPayer * 400n) / 10_000n) * payerCount;
      await tx.learningPathVersion.update({
        where: { pathId_versionNo: { pathId, versionNo: expectedVersion } },
        data: {
          feePolicyId: feePolicy.id,
          feeRateSnapshot: "0.04",
          feeAmountSnapshot: feeSnapshot,
          roundingSnapshot: { mode: "DOWN", precision: 2 },
        },
      });
      await this.creditLedger.holdPath(tx, {
        pathId,
        pathVersion: expectedVersion,
        exchangeType: agreement.exchangeType,
        participantAId: path.participantAId,
        participantBId: path.participantBId,
        teacherId: agreement.teacherId,
        learnerId: agreement.learnerId,
        totalCreditPerUser: agreement.totalCreditPerUser,
        negotiatedCredit: agreement.negotiatedCredit,
      });
      const sessions = sessionEntries.map((entry) => ({
        id: entry.id,
        pathId: entry.pathId,
        planId: entry.planId,
        planVersion: entry.planVersion,
        outlineSessionNo: entry.outlineSessionNo,
        teacherId: entry.teacherId,
        learnerId: entry.learnerId,
        startAt: entry.startAt,
        endAt: entry.endAt,
        status: entry.status,
      }));
      if (sessions.length !== 0)
        await tx.session.createMany({ data: sessions });
      if (sessionEntries.length !== 0) {
        await tx.sessionScheduleHistory.createMany({
          data: sessionEntries.map((entry) => ({
            sessionId: entry.id,
            scheduleItemId: entry.scheduleItemId,
            appliedAt: clock.now,
          })),
        });
      }
      for (const schedule of currentSchedules) {
        await tx.scheduleProposal.update({
          where: { id: schedule.scheduleProposalId },
          data: { status: "LOCKED", appliedVersion: schedule.versionNo },
        });
      }
      await tx.learningPath.update({
        where: { id: pathId },
        data: { status: "SCHEDULED", lockedVersion: expectedVersion },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "LEARNING_PATH",
          aggregateId: pathId,
          version: expectedVersion,
          type: "learning-path.locked",
          payload: { pathId, sessionIds },
          dedupeKey: `learning-path-locked:${pathId}:v${expectedVersion}`,
          correlationId: randomUUID(),
        },
      });
      return {
        pathId,
        version: expectedVersion,
        sessions: sessions.map(({ id, planId, startAt, endAt }) => ({
          id,
          planId,
          startAt,
          endAt,
        })),
        status: "SCHEDULED" as const,
      };
    });
  }

  async confirmPlan(actor: Principal, planId: string, expectedVersion: number) {
    return this.transactions.run(async (tx) => {
      const initial = await tx.learningPlan.findUnique({
        where: { id: planId },
      });
      if (!initial) throw new NotFoundException("LEARNING_PLAN_NOT_FOUND");
      await lockPath(tx, initial.pathId);
      const row = await tx.learningPlan.findUniqueOrThrow({
        where: { id: planId },
      });
      if (actor.userId !== row.learnerId) {
        throw new ForbiddenException("ONLY_LEARNER_CAN_CONFIRM_PLAN");
      }
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: row.pathId },
      });
      if (path.status !== "PROPOSED" && path.status !== "PARTIALLY_CONFIRMED") {
        throw new ConflictException("LEARNING_PATH_NOT_EDITABLE");
      }
      if (expectedVersion !== row.currentVersion) {
        throw new ConflictException("STALE_LEARNING_PLAN_VERSION");
      }
      const linked = await tx.pathVersionPlan.findUnique({
        where: {
          pathId_pathVersion_planId: {
            pathId: row.pathId,
            pathVersion: path.currentVersion,
            planId,
          },
        },
      });
      if (linked?.planVersion !== expectedVersion) {
        throw new ConflictException("PLAN_NOT_IN_CURRENT_AGREEMENT");
      }
      const currentPlanVersion = await tx.learningPlanVersion.findUniqueOrThrow(
        {
          where: { planId_versionNo: { planId, versionNo: expectedVersion } },
        },
      );
      if (!currentPlanVersion.learnerConfirmedAt) {
        await tx.learningPlanVersion.update({
          where: { planId_versionNo: { planId, versionNo: expectedVersion } },
          data: { learnerConfirmedAt: new Date() },
        });
      }
      await tx.learningPlan.update({
        where: { id: planId },
        data: { status: "CONFIRMED" },
      });
      await refreshPathConfirmation(tx, row.pathId);
      return {
        id: planId,
        version: expectedVersion,
        status: "CONFIRMED" as const,
      };
    });
  }

  async revisePlan(
    actor: Principal,
    planId: string,
    expectedVersion: number,
    input: CreateLearningPlanDto,
  ) {
    if (input.sessionOutline.length !== input.totalSessions) {
      throw new BadRequestException("SESSION_OUTLINE_COUNT_MISMATCH");
    }
    return this.transactions.run(async (tx) => {
      const plan = await tx.learningPlan.findUnique({ where: { id: planId } });
      if (!plan) throw new NotFoundException("LEARNING_PLAN_NOT_FOUND");
      await lockPath(tx, plan.pathId);
      const locked = await tx.learningPlan.findUniqueOrThrow({
        where: { id: planId },
      });
      if (
        actor.userId !== locked.teacherId ||
        actor.userId !== locked.createdByUserId
      ) {
        throw new ForbiddenException("ONLY_PLAN_TEACHER_CAN_REVISE");
      }
      if (locked.currentVersion !== expectedVersion) {
        throw new ConflictException("STALE_LEARNING_PLAN_VERSION");
      }
      const nextVersion = expectedVersion + 1;
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: locked.pathId },
      });
      if (path.status !== "PROPOSED" && path.status !== "PARTIALLY_CONFIRMED") {
        throw new ConflictException("LEARNING_PATH_NOT_EDITABLE");
      }
      const currentPathVersion = await tx.learningPathVersion.findUniqueOrThrow(
        {
          where: {
            pathId_versionNo: {
              pathId: locked.pathId,
              versionNo: path.currentVersion,
            },
          },
        },
      );
      await tx.learningPlan.update({
        where: { id: planId },
        data: { currentVersion: nextVersion, status: "PROPOSED" },
      });
      await tx.learningPlanVersion.create({
        data: {
          planId,
          versionNo: nextVersion,
          skillId: input.skillId,
          learningGoal: input.learningGoal,
          totalSessions: input.totalSessions,
          planSessionOutlinePlanVersionRecords: {
            create: input.sessionOutline.map((item, index) => ({
              sessionNo: index + 1,
              content: item.content,
            })),
          },
        },
      });
      const nextPathVersion = path.currentVersion + 1;
      await tx.learningPathVersion.create({
        data: {
          pathId: locked.pathId,
          versionNo: nextPathVersion,
          exchangeType: currentPathVersion.exchangeType,
          totalCreditPerUser: currentPathVersion.totalCreditPerUser,
          negotiatedCredit: currentPathVersion.negotiatedCredit,
          teacherId: currentPathVersion.teacherId,
          learnerId: currentPathVersion.learnerId,
          feePolicyId: currentPathVersion.feePolicyId,
          feeRateSnapshot: currentPathVersion.feeRateSnapshot,
          feeAmountSnapshot: currentPathVersion.feeAmountSnapshot,
          roundingSnapshot: currentPathVersion.roundingSnapshot ?? undefined,
          createdByUserId: actor.userId,
        },
      });
      await tx.learningPath.update({
        where: { id: locked.pathId },
        data: { currentVersion: nextPathVersion, status: "PROPOSED" },
      });
      const plans = await tx.learningPlan.findMany({
        where: { pathId: locked.pathId },
      });
      const matchingPlans = plans.filter((otherPlan) =>
        currentPathVersion.exchangeType === "ONE_WAY"
          ? otherPlan.teacherId === currentPathVersion.teacherId &&
            otherPlan.learnerId === currentPathVersion.learnerId
          : (otherPlan.teacherId === path.participantAId &&
              otherPlan.learnerId === path.participantBId) ||
            (otherPlan.teacherId === path.participantBId &&
              otherPlan.learnerId === path.participantAId),
      );
      if (matchingPlans.length !== 0) {
        await tx.pathVersionPlan.createMany({
          data: matchingPlans.map((otherPlan) => ({
            pathId: locked.pathId,
            pathVersion: nextPathVersion,
            planId: otherPlan.id,
            planVersion:
              otherPlan.id === planId ? nextVersion : otherPlan.currentVersion,
          })),
        });
      }
      await refreshPathConfirmation(tx, plan.pathId);
      return {
        id: planId,
        version: nextVersion,
        agreementVersion: nextPathVersion,
        status: "PROPOSED" as const,
      };
    });
  }
}
