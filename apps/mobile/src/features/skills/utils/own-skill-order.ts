import type { OwnSkill, Verification } from "../types/skills";
import { matchesSkillFilter, type SkillFilter } from "./skill-filter";
import { withSubmittedVerification } from "./verification-state";

export function recordCreatedSkillReads(
  created: Map<string, OwnSkill>,
  rows: OwnSkill[],
  complete = false,
) {
  for (const skill of rows) {
    const known = created.get(skill.id);
    if (known && skill.version >= known.version) created.set(skill.id, skill);
  }
  if (complete) {
    const present = new Set(rows.map((skill) => skill.id));
    for (const id of created.keys()) if (!present.has(id)) created.delete(id);
  }
}

// The current API orders by UUID and has no creation timestamps. Only confirmed
// creates in this session have a known creation order; older records stay stable.
export function ownSkillItems(
  loaded: OwnSkill[],
  created: Map<string, OwnSkill>,
  filter: SkillFilter,
  deleted: Set<string>,
  submitted: Map<string, Verification>,
) {
  const items = new Map(created);
  for (const skill of loaded) {
    const known = items.get(skill.id);
    if (!known || skill.version >= known.version) items.set(skill.id, skill);
  }
  const ranks = new Map([...created.keys()].map((id, index) => [id, index]));
  return [...items.values()]
    .filter((skill) => !skill.archivedAt && !deleted.has(skill.id))
    .map((skill) => withSubmittedVerification(skill, submitted))
    .filter((skill) => matchesSkillFilter(skill, filter))
    .sort((a, b) => (ranks.get(b.id) ?? -1) - (ranks.get(a.id) ?? -1));
}
