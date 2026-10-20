import type { TransactionContext } from "../../../infrastructure/database/transaction-context";

const definitions = [
  {
    code: "VERIFIED_MEMBER",
    title: "Verified Member",
    description: "Active account with verified email.",
    criteria: { emailVerified: true, accountStatus: "ACTIVE" },
  },
  {
    code: "FIRST_PATH",
    title: "First Path",
    description: "Complete one learning path.",
    criteria: { completedPaths: 1 },
  },
  {
    code: "FIVE_PATHS",
    title: "Path Builder",
    description: "Complete five learning paths.",
    criteria: { completedPaths: 5 },
  },
  {
    code: "TEN_TEACHING_PATHS",
    title: "Teaching Guide",
    description: "Teach ten completed learning paths.",
    criteria: { teachingPaths: 10 },
  },
  {
    code: "TRUSTED_MEMBER",
    title: "Trusted Member",
    description: "Reach 70 reputation and complete five paths.",
    criteria: { reputationScore: 70, completedPaths: 5 },
  },
  {
    code: "VETERAN",
    title: "Veteran",
    description: "Reach 180 days on the platform and complete ten paths.",
    criteria: { accountAgeDays: 180, completedPaths: 10 },
  },
  {
    code: "THREE_VERIFIED_SKILLS",
    title: "Verified Skills",
    description: "Have three verified skills.",
    criteria: { verifiedSkillCount: 3 },
  },
] as const;

export async function seedAchievements(tx: TransactionContext): Promise<void> {
  // `code` is the only unique key besides the generated id: existing definitions are kept as-is.
  await tx.achievement.createMany({
    data: definitions.map((definition) => ({ ...definition })),
    skipDuplicates: true,
  });
}
