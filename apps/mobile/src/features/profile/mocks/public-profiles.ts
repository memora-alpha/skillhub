import type { PublicProfile, PublicSkill } from "../types/profile";
import { toPublicProfile } from "../utils/public-profile";

export const demoSharingSkills: readonly PublicSkill[] = [
  {
    id: "sharing-react",
    skillId: "skill-react",
    name: "React & Frontend",
    level: "ADVANCED",
    description: "Xây dựng giao diện React và ứng dụng frontend.",
    experienceYears: "3.0",
    verificationStatus: "VERIFIED",
  },
  {
    id: "sharing-js",
    skillId: "skill-js",
    name: "JavaScript",
    level: "EXPERT",
    description: "JavaScript hiện đại và nền tảng lập trình web.",
    experienceYears: "4.0",
    verificationStatus: "VERIFIED",
  },
  {
    id: "sharing-ts",
    skillId: "skill-ts",
    name: "TypeScript",
    level: "INTERMEDIATE",
    description: "Kiểu dữ liệu và tổ chức code TypeScript.",
    experienceYears: "2.0",
    verificationStatus: "UNVERIFIED",
  },
];

const publicProfiles: readonly PublicProfile[] = [
  {
    userId: "demo-mentor-an",
    fullName: "Nguyễn An",
    headline: "Chia sẻ React và JavaScript",
    bio: "Mình thích cùng người học xây dựng các giao diện nhỏ và tìm hiểu cách giải quyết vấn đề từng bước.",
    avatarUrl: null,
    reputationScore: 78,
    verifiedSkillCount: 2,
    completedSessionCount: 12,
    sharingSkills: demoSharingSkills,
  },
  {
    userId: "demo-learner-linh",
    fullName: "Trần Linh",
    headline: "",
    bio: "",
    avatarUrl: null,
    reputationScore: 50,
    verifiedSkillCount: 0,
    completedSessionCount: 0,
    sharingSkills: [],
  },
];

export type PublicProfileResult =
  | { status: "ready"; profile: PublicProfile }
  | { status: "unavailable" }
  | { status: "error" };

// Only this reserved fixture fails once, so retry can be exercised without API calls.
export function resolvePublicProfile(
  targetId: string | null,
  own: PublicProfile,
  retry: number,
): PublicProfileResult {
  if (!targetId) return { status: "unavailable" };
  if (targetId === own.userId)
    return { status: "ready", profile: toPublicProfile(own) };
  if (targetId === "demo-retry" && retry === 0) return { status: "error" };
  const row = publicProfiles.find(
    (profile) =>
      profile.userId ===
      (targetId === "demo-retry" ? "demo-mentor-an" : targetId),
  );
  return row
    ? { status: "ready", profile: toPublicProfile(row) }
    : { status: "unavailable" };
}
