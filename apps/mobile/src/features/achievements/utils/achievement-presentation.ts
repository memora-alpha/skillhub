import type { IconName } from "@/components/Icon";
import type { Achievements } from "../api/achievements-api";

export const achievementGroups = [
  "Tất cả",
  "Học tập",
  "Chia sẻ",
  "Kỹ năng",
  "Cộng đồng",
  "Khác",
] as const;
export type AchievementGroup = (typeof achievementGroups)[number];
export function achievementGroup(code: string): AchievementGroup {
  if (["FIRST_PATH", "FIVE_PATHS", "TEN_PATHS"].includes(code))
    return "Học tập";
  if (
    [
      "FIRST_TEACHING_PATH",
      "FIVE_TEACHING_PATHS",
      "TEN_TEACHING_PATHS",
    ].includes(code)
  )
    return "Chia sẻ";
  if (
    [
      "FIRST_VERIFIED_SKILL",
      "THREE_VERIFIED_SKILLS",
      "FIVE_VERIFIED_SKILLS",
    ].includes(code)
  )
    return "Kỹ năng";
  if (["VERIFIED_MEMBER", "TRUSTED_MEMBER", "VETERAN"].includes(code))
    return "Cộng đồng";
  return "Khác";
}
export function achievementIcon(code: string): IconName {
  const group = achievementGroup(code);
  if (group === "Học tập") return "book";
  if (group === "Chia sẻ") return "users";
  if (group === "Kỹ năng") return "shield";
  return "award";
}
export function orderedAchievements(items: Achievements["items"]) {
  return [...items].sort(
    (a, b) =>
      Date.parse(b.unlockedAt) - Date.parse(a.unlockedAt) ||
      a.code.localeCompare(b.code),
  );
}
