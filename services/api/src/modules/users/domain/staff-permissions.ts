import { ForbiddenException } from "@nestjs/common";

/** Only operational permissions may be overridden; participation rights remain baseline. */
export const STAFF_DELEGABLE_PERMISSIONS = [
  "learning-request:moderation:read",
  "learning-request:approve",
  "learning-request:reject",
  "skill-verification:read",
  "skill-verification:approve",
  "skill-verification:reject",
  "report:moderate",
  "report:group",
  "report:classify",
  "report:communicate",
  "learning-path:terminate",
  "material:moderate",
] as const;

export type PermissionOverride = { code: string; effect: string };

export function resolveStaffPermissions(
  defaults: readonly string[],
  participation: readonly string[],
  overrides: readonly PermissionOverride[],
): string[] {
  const effective = new Set([...defaults, ...participation]);
  const allowed = new Set<string>(STAFF_DELEGABLE_PERMISSIONS);
  for (const { code, effect } of overrides) {
    if (!allowed.has(code)) continue;
    if (effect === "DENY") effective.delete(code);
    if (effect === "GRANT") effective.add(code);
  }
  return [...effective].sort((a, b) => a.localeCompare(b));
}

export function assertIndependentSkillReviewer(
  actor: { userId: string; roles: readonly string[] },
  ownerId: string,
  ownerRole: string,
) {
  if (actor.userId === ownerId)
    throw new ForbiddenException("SKILL_SELF_REVIEW_FORBIDDEN");
  if (ownerRole === "STAFF" && !actor.roles.includes("ADMIN"))
    throw new ForbiddenException("STAFF_SKILL_REQUIRES_ADMIN");
}
