import type { ApiSession, SessionRange } from "../api/sessions-api";

export function sessionMonthRange(year: number, month: number): SessionRange {
  return {
    from: new Date(year, month, 1).toISOString(),
    to: new Date(new Date(year, month + 1, 1).getTime() - 1).toISOString(),
  };
}

export function isSessionHistory(
  session: Pick<ApiSession, "status" | "endAt">,
  now: number,
) {
  return (
    ["AWAITING_CONFIRMATION", "COMPLETED", "CANCELLED", "DISPUTED"].includes(
      session.status,
    ) || Date.parse(session.endAt) <= now
  );
}

export function filterCalendarSessions(
  sessions: ApiSession[],
  day: number | null,
  history: boolean,
  now: number,
) {
  return sessions.filter(
    (session) =>
      (day === null || new Date(session.startAt).getDate() === day) &&
      isSessionHistory(session, now) === history,
  );
}

export function sessionConfirmations(session: ApiSession) {
  const teacher = session.role === "TEACHER";
  return {
    mine:
      (teacher
        ? session.teacherConfirmationStatus
        : session.learnerConfirmationStatus) === "CONFIRMED",
    partner:
      (teacher
        ? session.learnerConfirmationStatus
        : session.teacherConfirmationStatus) === "CONFIRMED",
  };
}

export function canConfirmSession(session: ApiSession, now: number) {
  return (
    session.status === "AWAITING_CONFIRMATION" &&
    Date.parse(session.endAt) <= now &&
    !sessionConfirmations(session).mine
  );
}

export const sessionStatusLabels: Record<ApiSession["status"], string> = {
  CONFIRMED: "Đã chốt lịch",
  READY: "Sẵn sàng vào học",
  ONGOING: "Đang học",
  AWAITING_CONFIRMATION: "Chờ xác nhận hoàn thành",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
  DISPUTED: "Đang có tranh chấp",
};
