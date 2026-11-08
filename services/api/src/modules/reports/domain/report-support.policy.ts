import { ConflictException, ForbiddenException } from "@nestjs/common";
export const REPORT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const OPEN_REPORT_STATUSES = ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"];
export function assertIndependentCaseActor(
  actorId: string,
  parties: readonly string[],
) {
  if (parties.includes(actorId))
    throw new ForbiddenException("REPORT_SELF_MODERATION_FORBIDDEN");
}
export function assertSameIncident(
  cases: {
    targetType: string;
    targetId: string;
    relatedSessionId: string | null;
    relatedPathId: string | null;
  }[],
) {
  const first = cases[0];
  if (
    !first ||
    cases.some(
      (item) =>
        item.targetType !== first.targetType ||
        item.targetId !== first.targetId ||
        item.relatedSessionId !== first.relatedSessionId ||
        item.relatedPathId !== first.relatedPathId,
    )
  )
    throw new ConflictException("REPORT_INCIDENT_TARGET_MISMATCH");
}
export function assertPrivateCaseThread(
  actorId: string,
  partyId: string,
  handlerId: string | null,
  parties: readonly string[],
  staff: boolean,
) {
  if (!parties.includes(partyId))
    throw new ForbiddenException("CASE_PARTY_REQUIRED");
  if (actorId === partyId) return;
  if (!staff || handlerId !== actorId)
    throw new ForbiddenException("CASE_THREAD_ACCESS_DENIED");
  assertIndependentCaseActor(actorId, parties);
}
