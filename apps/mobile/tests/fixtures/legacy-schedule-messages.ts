import type { ScheduleConfirmation } from "../../src/features/learning-paths/utils/schedule-confirmation-message";
import { confirmedFormMessage } from "../../src/features/learning-paths/utils/confirmed-form";

// Historical participant TEXT messages. Current clients let BE publish SYSTEM events.
export function scheduledMessage(result: {
  pathId: string;
  version: number;
  sessions: readonly { startAt: string; endAt: string }[];
}) {
  const query = new URLSearchParams({
    version: String(result.version),
    sessions: String(result.sessions.length),
    startAt: new Date(
      Math.min(
        ...result.sessions.map((session) => Date.parse(session.startAt)),
      ),
    ).toISOString(),
    endAt: new Date(
      Math.max(...result.sessions.map((session) => Date.parse(session.endAt))),
    ).toISOString(),
  });
  return `Lịch học đã chốt\n${result.sessions.length} buổi học\nskillhub://scheduled/${result.pathId}?${query}`;
}

export function scheduleConfirmationMessage(input: ScheduleConfirmation) {
  const teacher = input.confirmedBy === input.teacherId;
  const confirmedRole = teacher ? "Người dạy" : "Người học";
  const waitingRole = teacher ? "người học" : "người dạy";
  const summary = input.bothConfirmed
    ? "Hai bên đã đồng ý lịch này · Chưa chốt lịch."
    : `${confirmedRole} đã đồng ý · Chờ ${waitingRole} xác nhận.`;
  const message = confirmedFormMessage({
    kind: "schedule",
    pathId: input.pathId,
    planId: input.planId,
    scheduleId: input.scheduleId,
    version: input.version,
    title: input.title.trim().replace(/\s+/g, " ").slice(0, 160) || "Lịch học",
    summary,
  });
  const metadata = new URLSearchParams({
    scheduleConfirmation: "1",
    confirmedBy: input.confirmedBy,
    teacherId: input.teacherId,
    learnerId: input.learnerId,
    bothConfirmed: String(input.bothConfirmed),
  });
  return `${message}&${metadata}`;
}
