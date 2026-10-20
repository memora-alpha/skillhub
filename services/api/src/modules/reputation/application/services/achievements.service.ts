import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { Principal } from "../../../auth/application/services/sessions.service";

type AchievementFacts = {
  emailVerified: boolean;
  accountStatus: string;
  reputationScore: number;
  verifiedSkillCount: number;
  accountAgeDays: number;
  completedPaths: number;
  teachingPaths: number;
};

function achieved(code: string, facts: AchievementFacts): boolean {
  switch (code) {
    case "VERIFIED_MEMBER":
      return facts.emailVerified && facts.accountStatus === "ACTIVE";
    case "FIRST_PATH":
      return facts.completedPaths >= 1;
    case "FIVE_PATHS":
      return facts.completedPaths >= 5;
    case "TEN_TEACHING_PATHS":
      return facts.teachingPaths >= 10;
    case "TRUSTED_MEMBER":
      return facts.reputationScore >= 70 && facts.completedPaths >= 5;
    case "VETERAN":
      return facts.accountAgeDays >= 180 && facts.completedPaths >= 10;
    case "THREE_VERIFIED_SKILLS":
      return facts.verifiedSkillCount >= 3;
    default:
      return false;
  }
}

@Injectable()
export class AchievementsService {
  constructor(private readonly transactions: TransactionRunner) {}

  async evaluate(
    tx: TransactionContext,
    userId: string,
    now: Date,
  ): Promise<void> {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("USER_NOT_FOUND");
    const completedPaths = await tx.learningPath.count({
      where: {
        status: "COMPLETED",
        OR: [{ participantAId: userId }, { participantBId: userId }],
      },
    });
    const teachingPaths = await tx.learningPlan.count({
      where: {
        teacherId: userId,
        pathIdRecord: { is: { status: "COMPLETED" } },
      },
    });
    const facts: AchievementFacts = {
      emailVerified: user.emailVerified,
      accountStatus: user.accountStatus,
      reputationScore: user.reputationScore,
      verifiedSkillCount: user.verifiedSkillCount,
      accountAgeDays: Math.floor(
        (now.getTime() - user.createdAt.getTime()) / 86_400_000,
      ),
      completedPaths,
      teachingPaths,
    };
    const definitions = await tx.achievement.findMany({
      where: { active: true },
    });
    const unlocked = await tx.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    });
    const unlockedIds = new Set(
      unlocked.map(({ achievementId }) => achievementId),
    );
    const newlyUnlocked = definitions.filter(
      (definition) =>
        !unlockedIds.has(definition.id) && achieved(definition.code, facts),
    );
    if (newlyUnlocked.length !== 0) {
      await tx.userAchievement.createMany({
        data: newlyUnlocked.map((definition) => ({
          userId,
          achievementId: definition.id,
          unlockedAt: now,
          sourceSnapshot: facts,
        })),
      });
    }
  }

  mine(actor: Principal) {
    return this.transactions.run(async (tx) => {
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (!(clock?.now instanceof Date))
        throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
      await this.evaluate(tx, actor.userId, clock.now);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: actor.userId },
        select: { selectedTitle: true },
      });
      const items = await tx.userAchievement.findMany({
        where: {
          userId: actor.userId,
          achievementIdRecord: { is: { active: true } },
        },
        include: { achievementIdRecord: true },
        orderBy: { unlockedAt: "asc" },
      });
      return {
        selectedTitle: user.selectedTitle,
        items: items.map(({ achievementIdRecord, unlockedAt }) => ({
          code: achievementIdRecord.code,
          title: achievementIdRecord.title,
          description: achievementIdRecord.description,
          unlockedAt,
        })),
      };
    });
  }

  selectTitle(actor: Principal, code: string | null) {
    return this.transactions.run(async (tx) => {
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (!(clock?.now instanceof Date))
        throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
      await this.evaluate(tx, actor.userId, clock.now);
      const title =
        code === null
          ? null
          : await tx.achievement.findFirst({
              where: {
                code,
                active: true,
                userAchievementAchievementIdRecords: {
                  some: { userId: actor.userId },
                },
              },
              select: { title: true },
            });
      if (code !== null && !title)
        throw new ConflictException("TITLE_NOT_UNLOCKED");
      await tx.user.update({
        where: { id: actor.userId },
        data: { selectedTitle: title?.title ?? null },
      });
      return { selectedTitle: title?.title ?? null };
    });
  }
}
