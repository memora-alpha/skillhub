import type { Skill } from "../types";

export type PublicSharingSkill = {
  id: string;
  skill: Skill;
  level: string;
  skillLevel: { name: string; code: string } | null;
  description: string;
  experienceYears: string | null;
  verificationStatus: string;
};

export type PublicProfile = {
  userId: string;
  fullName: string;
  headline: string;
  bio: string;
  avatarUrl: string | null;
  reputationScore: number;
  verifiedSkillCount: number;
  completedSessionCount: number;
  completedLearningPathCount: number;
  reviewSummary?: import("../account/profile-reviews").ReviewSummary;
  selectedTitle: string | null;
};

export type SkillSharer = PublicSharingSkill & {
  user: Pick<
    PublicProfile,
    "userId" | "fullName" | "bio" | "avatarUrl" | "reputationScore"
  >;
};
