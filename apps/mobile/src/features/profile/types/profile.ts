export type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
export type VerificationStatus =
  "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

export type PublicSkill = Readonly<{
  id: string;
  skillId: string;
  name: string;
  level: SkillLevel;
  description: string;
  experienceYears: string | null;
  verificationStatus: VerificationStatus;
}>;

export type PublicProfile = Readonly<{
  userId: string;
  fullName: string;
  headline: string;
  bio: string;
  avatarUrl: string | null;
  reputationScore: number | null;
  verifiedSkillCount: number;
  completedSessionCount: number;
  selectedTitle?: string | null;
  sharingSkills: readonly PublicSkill[];
}>;

export type ProfileDraft = { fullName: string; headline: string; bio: string };
export type ProfileErrors = Partial<Record<keyof ProfileDraft, string>>;
