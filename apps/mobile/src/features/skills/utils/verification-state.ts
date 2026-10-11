import type { OwnSkill, Verification } from "../types/skills";

export function hasPendingVerification(skill: OwnSkill) {
  return (
    skill.latestVerification?.status === "PENDING" ||
    skill.verificationStatus === "PENDING"
  );
}

export function withSubmittedVerification(
  skill: OwnSkill,
  submitted: Map<string, Verification>,
): OwnSkill {
  const batch = submitted.get(skill.id);
  if (!batch || batch.status !== "PENDING") return skill;
  const latest = skill.latestVerification;
  if (
    latest &&
    ((latest.id === batch.id && latest.status !== "PENDING") ||
      Date.parse(latest.submittedAt) > Date.parse(batch.submittedAt))
  ) {
    submitted.delete(skill.id);
    return skill;
  }
  return {
    ...skill,
    latestVerification: batch,
    verificationStatus:
      skill.verificationStatus === "VERIFIED" ? "VERIFIED" : "PENDING",
  };
}

export function verificationItems(
  items: Verification[],
  submitted?: Verification,
) {
  const known = items.find((item) => item.id === submitted?.id);
  const current =
    submitted && (!known || known.version < submitted.version)
      ? [submitted, ...items.filter((item) => item.id !== submitted.id)]
      : items;
  return [...current].sort(
    (a, b) =>
      Date.parse(b.submittedAt) - Date.parse(a.submittedAt) ||
      b.id.localeCompare(a.id),
  );
}
