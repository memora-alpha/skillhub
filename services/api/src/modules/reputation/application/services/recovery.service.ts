import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import { lockUsers } from "../../../../shared/database/identity-transactions";
import { ReputationService } from "./reputation.service";
import { recoveryPolicy } from "../../domain/restriction-policy";

const day = 86_400_000;
const budget = 5;
export const CLAIMABLE_MISSIONS = [
  "GOOD_BEHAVIOR_STREAK",
  "COMMITMENT_RECOVERY",
] as const;
type ClaimableMission = (typeof CLAIMABLE_MISSIONS)[number];
type Mission = "POLICY_AWARENESS" | ClaimableMission;
const rewards: Record<Mission, number> = {
  POLICY_AWARENESS: 2,
  GOOD_BEHAVIOR_STREAK: 2,
  COMMITMENT_RECOVERY: 3,
};

const policyQuiz = [
  [
    "Chỉ xác nhận hoàn thành buổi học khi buổi học thực sự đã hoàn thành.",
    true,
  ],
  ["Có thể dùng tài khoản phụ để tạo buổi học giả và nhận điểm.", false],
  [
    "Khi không thể tham gia buổi đã chốt, cần thông báo và dùng luồng đổi lịch hoặc hủy phù hợp.",
    true,
  ],
  ["Tăng Reputation tự động kết thúc thời hạn khóa đang áp dụng.", false],
  ["Người dùng cần cung cấp thông tin trung thực khi gửi report.", true],
] as const;
const quizVersion = "1";

@Injectable()
export class RecoveryService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly reputation: ReputationService,
  ) {}

  mine(userId: string) {
    return this.transactions.run(async (tx) => {
      const state = await this.state(tx, userId);
      if (!state)
        return {
          eligible: false,
          missions: [],
          quiz: null,
          remainingBudget: 0,
        };
      const progress = await this.progress(tx, userId, state);
      const missions = state.missions.map((code) => ({
        code,
        reward: rewards[code],
        claimed: state.claims.some(
          (row) => row.eventKey === this.eventKey(state.cycle, code),
        ),
        progress: progress[code],
      }));
      return {
        eligible: true,
        missions,
        remainingBudget: state.remainingBudget,
        quiz: {
          version: quizVersion,
          policy: recoveryPolicy,
          questions: policyQuiz.map(([statement]) => statement),
        },
      };
    });
  }

  submitQuiz(userId: string, version: string, answers: boolean[]) {
    if (version !== quizVersion || answers.length !== policyQuiz.length)
      throw new ConflictException("RECOVERY_QUIZ_VERSION_OR_LENGTH_INVALID");
    const correct = policyQuiz.filter(
      ([, answer], index) => answers[index] === answer,
    ).length;
    if (correct * 100 < policyQuiz.length * 80)
      return { passed: false, awarded: 0 };
    return this.claimVerified(userId, "POLICY_AWARENESS");
  }

  claim(userId: string, mission: ClaimableMission) {
    return this.claimVerified(userId, mission);
  }

  private claimVerified(userId: string, mission: Mission) {
    return this.transactions.run(async (tx) => {
      await lockUsers(tx, [userId]);
      const state = await this.state(tx, userId);
      if (!state?.missions.includes(mission))
        throw new ForbiddenException("RECOVERY_MISSION_NOT_ELIGIBLE");
      const existing = state.claims.find(
        (row) => row.eventKey === this.eventKey(state.cycle, mission),
      );
      if (existing) return { passed: true, awarded: existing.delta };
      if (
        mission !== "POLICY_AWARENESS" &&
        !(await this.progress(tx, userId, state))[mission].complete
      )
        throw new ConflictException("RECOVERY_MISSION_INCOMPLETE");
      const awarded = Math.min(
        rewards[mission],
        state.remainingBudget,
        100 - state.score,
      );
      await this.reputation.apply(tx, {
        userId,
        delta: awarded,
        reasonCode: "RECOVERY_MISSION_REWARD",
        sourceType: "RECOVERY_MISSION",
        sourceId: state.cycle,
        eventKey: this.eventKey(state.cycle, mission),
        now: state.now,
      });
      return { passed: true, awarded };
    });
  }

  private eventKey(cycle: string, mission: Mission) {
    return `recovery:${cycle}:${mission}`;
  }

  private async state(tx: TransactionContext, userId: string) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.accountStatus !== "ACTIVE" || user.reputationScore >= 40)
      return null;
    const [clock] = await tx.$queryRaw<
      { now: Date }[]
    >`SELECT clock_timestamp() AS now`;
    if (!(clock?.now instanceof Date))
      throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
    const now = clock.now;
    const fullLock = await tx.userRestriction.findFirst({
      where: {
        userId,
        scope: "ALL",
        revokedAt: null,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
    });
    if (fullLock) return null;
    const crossing = await tx.reputationHistory.findFirst({
      where: { userId, scoreBefore: { gte: 40 }, scoreAfter: { lt: 40 } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const cycle = crossing?.id ?? userId;
    const startedAt = crossing?.createdAt ?? user.createdAt;
    const reversals = await tx.reputationHistory.findMany({
      where: { userId, sourceType: "REPUTATION_REVERSAL" },
      select: { sourceId: true },
    });
    const reversedIds = reversals.map(({ sourceId }) => sourceId);
    const violations = await tx.reputationHistory.findMany({
      where: {
        userId,
        sourceType: "ADJUDICATED_VIOLATION",
        createdAt: { gte: startedAt },
        id: { notIn: reversedIds },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const cycleViolation = violations[0];
    const secondary =
      cycleViolation &&
      ["NO_SHOW", "LATE_CANCELLATION"].includes(cycleViolation.reasonCode)
        ? "COMMITMENT_RECOVERY"
        : "GOOD_BEHAVIOR_STREAK";
    const missions: Mission[] = ["POLICY_AWARENESS", secondary];
    const claims = await tx.reputationHistory.findMany({
      where: {
        userId,
        eventKey: {
          in: missions.map((mission) => this.eventKey(cycle, mission)),
        },
      },
    });
    const totals = await tx.reputationHistory.aggregate({
      where: {
        userId,
        sourceType: "RECOVERY_MISSION",
        createdAt: { gt: new Date(now.getTime() - 30 * day) },
      },
      _sum: { delta: true },
    });
    return {
      now,
      startedAt,
      cycle,
      missions,
      claims,
      reversedIds,
      violations,
      score: user.reputationScore,
      streakStart: cycleViolation?.createdAt ?? startedAt,
      remainingBudget: Math.max(0, budget - (totals._sum.delta ?? 0)),
    };
  }

  private async progress(
    tx: TransactionContext,
    userId: string,
    state: NonNullable<Awaited<ReturnType<RecoveryService["state"]>>>,
  ) {
    const reportIds = state.violations
      .filter(({ eventKey }) => eventKey.startsWith("report-case:"))
      .map(({ sourceId }) => sourceId);
    const reports = await tx.reportCase.findMany({
      where: { id: { in: reportIds } },
      select: { relatedSessionId: true },
    });
    const penalizedSessions = new Set(
      reports.flatMap(({ relatedSessionId }) =>
        relatedSessionId ? [relatedSessionId] : [],
      ),
    );
    const sessions = await tx.session.findMany({
      where: {
        OR: [{ teacherId: userId }, { learnerId: userId }],
        startAt: { gte: state.startedAt },
        endAt: { lte: state.now },
        status: "COMPLETED",
        teacherConfirmationStatus: "CONFIRMED",
        learnerConfirmationStatus: "CONFIRMED",
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        attendanceOutcomes: {
          where: {
            status: "FINAL",
            attendanceCase: "BOTH_PRESENT",
            resolution: "COMPLETED_MUTUAL",
          },
          select: { occurrenceStartAt: true },
        },
      },
    });
    const valid = sessions.filter(
      (session) =>
        !penalizedSessions.has(session.id) &&
        session.attendanceOutcomes.some(
          (outcome) =>
            outcome.occurrenceStartAt.getTime() === session.startAt.getTime(),
        ),
    );
    const policyClaim = state.claims.find(
      ({ eventKey, id }) =>
        eventKey === this.eventKey(state.cycle, "POLICY_AWARENESS") &&
        !state.reversedIds.includes(id),
    );
    const inStreak = (date: Date) =>
      date >= state.streakStart && date <= state.now;
    const active =
      (policyClaim && inStreak(policyClaim.createdAt)) ||
      valid.some(({ endAt }) => inStreak(endAt));
    const streakDays = Math.min(
      14,
      Math.floor((state.now.getTime() - state.streakStart.getTime()) / day),
    );
    return {
      POLICY_AWARENESS: {
        current: policyClaim ? 1 : 0,
        target: 1,
        complete: Boolean(policyClaim),
      },
      GOOD_BEHAVIOR_STREAK: {
        current: streakDays,
        target: 14,
        complete: Boolean(active) && streakDays >= 14,
      },
      COMMITMENT_RECOVERY: {
        current: Math.min(2, valid.length),
        target: 2,
        complete: valid.length >= 2,
      },
    };
  }
}
