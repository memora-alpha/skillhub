import { AppError } from "@/lib/http/errors";
type Skill = {
  id: string;
  archivedAt: string | null;
  skill: { id: string; status: string };
  verificationStatus: string;
};

function activeSkillFor(skills: Skill[], skillId: string) {
  return skills.filter(
    (skill) =>
      skill.skill.id === skillId &&
      !skill.archivedAt &&
      skill.skill.status === "ACTIVE",
  );
}

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
    const skills = activeSkillFor(page.data, skillId);
    const eligible = skills.find(
      (skill) => !verifiedRequired || skill.verificationStatus === "VERIFIED",
    );
    if (eligible)
      return { state: "eligible" as const, sharingSkillId: eligible.id };
    if (verifiedRequired) unverified = skills.at(-1)?.id ?? unverified;
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
