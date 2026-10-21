import { AppError } from "@/lib/http/errors";
type Skill = {
  id: string;
  archivedAt: string | null;
  skill: { id: string; status: string };
  verificationStatus: string;
};
export async function readTeacherEligibility(
  read: (
    cursor?: string,
    signal?: AbortSignal,
  ) => Promise<{
    data: Skill[];
    pagination: { hasMore: boolean; nextCursor: string | null };
  }>,
  skillId: string,
  verifiedRequired: boolean,
  signal: AbortSignal,
  assertCurrent: () => void,
) {
  let cursor: string | undefined;
  const seen = new Set<string>();
  let unverified: string | undefined;
  do {
    if (signal.aborted) throw new AppError("session");
    const page = await read(cursor, signal);
    assertCurrent();
    for (const skill of page.data) {
      if (
        skill.skill.id !== skillId ||
        skill.archivedAt ||
        skill.skill.status !== "ACTIVE"
      )
        continue;
      if (!verifiedRequired || skill.verificationStatus === "VERIFIED")
        return { state: "eligible" as const, sharingSkillId: skill.id };
      unverified = skill.id;
    }
    if (!page.pagination.hasMore)
      return unverified
        ? { state: "unverified" as const, sharingSkillId: unverified }
        : { state: "missing" as const };
    const next = page.pagination.nextCursor;
    if (!next || seen.has(next)) throw new AppError("protocol");
    seen.add(next);
    cursor = next;
  } while (cursor);
  throw new AppError("protocol");
}
