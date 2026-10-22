import { StaffApiError } from "./client";

export type Achievement = {
  code: string;
  title: string;
  description: string;
  unlockedAt: string;
};
export type Achievements = {
  selectedTitle: string | null;
  items: Achievement[];
};
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function parseSelectedTitle(value: unknown) {
  if (
    !record(value) ||
    !(value.selectedTitle === null || typeof value.selectedTitle === "string")
  )
    throw new StaffApiError(502, "API_RESPONSE_INVALID");
  return { selectedTitle: value.selectedTitle as string | null };
}
export function parseAchievements(value: unknown): Achievements {
  const title = parseSelectedTitle(value);
  if (
    !record(value) ||
    !Array.isArray(value.items) ||
    !value.items.every(
      (item: unknown) =>
        record(item) &&
        typeof item.code === "string" &&
        item.code.length > 0 &&
        typeof item.title === "string" &&
        item.title.length > 0 &&
        typeof item.description === "string" &&
        typeof item.unlockedAt === "string" &&
        Number.isFinite(Date.parse(item.unlockedAt)),
    )
  )
    throw new StaffApiError(502, "API_RESPONSE_INVALID");
  return {
    ...title,
    items: value.items.map((item: Achievement) => ({
      code: item.code,
      title: item.title,
      description: item.description,
      unlockedAt: item.unlockedAt,
    })),
  };
}
