import type { PublicProfile } from "../types/profile";
import type { OwnProfile } from "@/features/account";

export function toOwnProfilePreview(source: OwnProfile): PublicProfile {
  return {
    userId: source.userId,
    fullName: source.fullName,
    headline: source.headline,
    bio: source.bio,
    avatarUrl: source.avatarUrl,
    reputationScore: source.reputationScore,
    verifiedSkillCount: source.verifiedSkillCount,
    completedSessionCount: source.completedSessionCount,
    sharingSkills: [],
  };
}

// Explicit projection: never forward private account fields or nested metadata.
export function toPublicProfile(source: PublicProfile): PublicProfile {
  return {
    userId: source.userId,
    fullName: source.fullName,
    headline: source.headline,
    bio: source.bio,
    avatarUrl: source.avatarUrl,
    reputationScore: source.reputationScore,
    verifiedSkillCount: source.verifiedSkillCount,
    completedSessionCount: source.completedSessionCount,
    sharingSkills: source.sharingSkills.map((skill) => ({
      id: skill.id,
      skillId: skill.skillId,
      name: skill.name,
      level: skill.level,
      description: skill.description,
      experienceYears: skill.experienceYears,
      verificationStatus: skill.verificationStatus,
    })),
  };
}

export function readProfileId(
  value: string | string[] | undefined,
): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
