import { systemCodeLabel } from "@/lib/system-text";
import type { SharingSkill } from "../types";

export const DESCRIPTION_MIN_LENGTH = 20;
export const DESCRIPTION_MAX_LENGTH = 1500;
export const EXPERIENCE_YEARS_PATTERN = /^(?:[0-5]?\d(?:\.\d)?|60(?:\.0)?)$/;

export type SkillLevelOption = {
  id: string;
  name: string;
  code: string;
  status: string;
  sortOrder?: number;
};

export function sortActiveLevels<
  T extends { id: string; status: string; sortOrder?: number },
>(levels?: readonly T[]): T[] {
  if (!levels) return [];
  return levels
    .filter((level) => level.status === "ACTIVE")
    .sort(
      (left, right) =>
        (left.sortOrder ?? 0) - (right.sortOrder ?? 0) ||
        left.id.localeCompare(right.id),
    );
}

export function normalizeExperienceInput(raw: string): string {
  return raw.trim().replace(",", ".");
}

export function formatExperienceYears(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const display = trimmed.endsWith(".0") ? trimmed.slice(0, -2) : trimmed;
  return `${display} năm kinh nghiệm`;
}

export function skillLevelDisplay(skill: SharingSkill): string {
  return (
    skill.skillLevel?.name ??
    systemCodeLabel(skill.level, skill.level || "Chưa rõ trình độ")
  );
}

export function verificationStatusLabel(status?: string): string {
  switch (status) {
    case "VERIFIED":
      return "Đã xác minh";
    case "PENDING":
      return "Chờ duyệt xác minh";
    case "REJECTED":
      return "Bị từ chối";
    default:
      return "Chưa xác minh";
  }
}

export function skillMonogram(name: string): string {
  const words = name
    .trim()
    .split(/[\s/.-]+/)
    .filter(Boolean);
  if (words.length >= 2) {
    const first = Array.from(words[0] ?? "")[0] ?? "";
    const second = Array.from(words[1] ?? "")[0] ?? "";
    return (first + second).toUpperCase();
  }
  const chars = Array.from(name.trim());
  return chars.slice(0, 2).join("").toUpperCase() || "KN";
}

export function skillToneIndex(name: string): 0 | 1 | 2 | 3 {
  let hash = 0;
  for (const ch of name) {
    hash = (hash * 31 + ch.charCodeAt(0)) % 4;
  }
  return hash as 0 | 1 | 2 | 3;
}
