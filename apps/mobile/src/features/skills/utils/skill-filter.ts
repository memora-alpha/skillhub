import type { Page } from "@/lib/http/response";
import type { InfiniteData } from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import type { OwnSkill } from "../types/skills";
import {
  hasPendingVerification,
  withSubmittedVerification,
} from "./verification-state";
import type { Verification } from "../types/skills";

export type SkillFilter = "ALL" | "VERIFIED" | "UNVERIFIED" | "PENDING";
export function matchesSkillFilter(skill: OwnSkill, filter: SkillFilter) {
  if (filter === "ALL") return true;
  if (filter === "PENDING") return hasPendingVerification(skill);
  return filter === "VERIFIED"
    ? skill.verificationStatus === "VERIFIED"
    : skill.verificationStatus !== "VERIFIED";
}
export function skillListPlaceholder(
  data: InfiniteData<Page<OwnSkill>, string | undefined> | undefined,
  filter: SkillFilter,
  deleted: Set<string>,
  submitted: Map<string, Verification>,
) {
  if (!data) return undefined;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data
        .map((skill) => withSubmittedVerification(skill, submitted))
        .filter(
          (skill) =>
            !skill.archivedAt &&
            !deleted.has(skill.id) &&
            matchesSkillFilter(skill, filter),
        ),
    })),
  };
}
export async function filteredSkillPage(
  read: (cursor?: string) => Promise<Page<OwnSkill>>,
  filter: SkillFilter,
  cursor?: string,
): Promise<Page<OwnSkill>> {
  const seen = new Set<string>();
  if (cursor) seen.add(cursor);
  for (;;) {
    const result = await read(cursor);
    const data = result.data.filter((skill) =>
      matchesSkillFilter(skill, filter),
    );
    const next = result.pagination.nextCursor ?? undefined;
    if (result.pagination.hasMore && (!next || seen.has(next)))
      throw new AppError("protocol");
    if (data.length || !result.pagination.hasMore) return { ...result, data };
    cursor = next!;
    seen.add(cursor);
  }
}
