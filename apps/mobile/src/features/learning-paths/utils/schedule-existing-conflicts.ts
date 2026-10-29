import type { LearningSession } from "@/features/sessions";
import {
  scheduleBusyRange,
  scheduleOverlap,
  scheduleWindowLabel,
  type ScheduleSlot,
} from "./schedule-conflicts";

export type ExistingScheduleConflict = {
  slot: ScheduleSlot;
  session: LearningSession;
};

export function existingScheduleRange(slots: readonly ScheduleSlot[]) {
  if (!slots.length) return undefined;
  const start = Math.min(...slots.map((slot) => Date.parse(slot.startAt)));
  const end = Math.max(...slots.map((slot) => Date.parse(slot.endAt)));
  const range = scheduleBusyRange({
    startAt: new Date(start).toISOString(),
    endAt: new Date(end).toISOString(),
  });
  return { from: range.from, to: range.to };
}

export function existingScheduleConflicts(
  slots: readonly ScheduleSlot[],
  sessions: readonly LearningSession[],
  pathId: string,
): ExistingScheduleConflict[] {
  return slots.flatMap((slot) =>
    sessions
      .filter(
        (session) =>
          session.pathId !== pathId &&
          session.status !== "CANCELLED" &&
          scheduleOverlap(slot, session),
      )
      .map((session) => ({ slot, session })),
  );
}

export function existingScheduleConflictMessage({
  session,
}: ExistingScheduleConflict) {
  const role = session.role === "TEACHER" ? "dạy" : "học";
  return `Trùng lịch ${role} ở lộ trình khác: ${scheduleWindowLabel(session)}.`;
}
