import type { LearningSession } from "../types";
import type { SessionContext } from "./session-context";

export function rescheduleSnapshot(
  session: LearningSession,
  context: SessionContext,
  userId: string,
) {
  const { path, plan, actual } = context,
    schedule = plan.schedule;
  if (
    ![path.participantAId, path.participantBId].includes(userId) ||
    !schedule ||
    schedule.appliedVersion === null ||
    schedule.version < schedule.appliedVersion ||
    Date.parse(actual.startAt) !== Date.parse(session.startAt) ||
    Date.parse(actual.endAt) !== Date.parse(session.endAt)
  )
    return;
  const items = schedule.items.filter(
    (item) => item.sessionNo === actual.sessionNo,
  );
  if (items.length !== 1) return;
  const item = items[0]!;
  if (Date.parse(item.endAt) <= Date.parse(item.startAt)) return;
  const changed =
    Date.parse(item.startAt) !== Date.parse(actual.startAt) ||
    Date.parse(item.endAt) !== Date.parse(actual.endAt);
  if (schedule.version === schedule.appliedVersion && changed) return;
  const isA = userId === path.participantAId;
  const hasPending =
    schedule.version > schedule.appliedVersion &&
    ["PROPOSED", "NEEDS_REVISION", "PARTIALLY_CONFIRMED"].includes(
      schedule.status,
    );
  return {
    scheduleId: schedule.id,
    status: schedule.status,
    version: schedule.version,
    appliedVersion: schedule.appliedVersion,
    hasPending,
    pending: hasPending && changed,
    item,
    ownConfirmed: !!(isA
      ? schedule.participantAConfirmedAt
      : schedule.participantBConfirmedAt),
    partnerConfirmed: !!(isA
      ? schedule.participantBConfirmedAt
      : schedule.participantAConfirmedAt),
  };
}
