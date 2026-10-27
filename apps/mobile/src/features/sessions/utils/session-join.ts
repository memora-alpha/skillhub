import type { LearningSession } from "../types";

type JoinSession = Pick<
  LearningSession,
  "status" | "startAt" | "endAt" | "join"
>;
export const sessionEarlyJoinMs = 15 * 60_000;

const messages: Record<string, string> = {
  LIVEKIT_DISABLED: "Phòng học chưa được máy chủ kích hoạt.",
  LIVEKIT_POLICY_NOT_READY: "Máy chủ chưa cấu hình thời gian mở phòng học.",
  JOIN_WINDOW_NOT_OPEN:
    "Chưa đến giờ mở phòng. Bạn có thể vào sớm tối đa 15 phút trước giờ học.",
  JOIN_WINDOW_CLOSED: "Đã hết thời gian vào phòng học.",
  SESSION_NOT_JOINABLE: "Buổi học hiện không cho phép vào phòng.",
  SESSION_ENDED:
    "Buổi học đã kết thúc. Phòng học đã đóng và không thể vào hoặc kết nối lại.",
};
export function joinReason(reason?: string | null) {
  return (
    messages[reason ?? ""] ??
    "Chưa có thông tin mở phòng. Hãy tải lại buổi học."
  );
}
export function sessionJoinReason(
  session?: JoinSession,
  now = Date.now(),
): string | null {
  if (!session) return "JOIN_STATUS_UNAVAILABLE";
  const start = Date.parse(session.startAt);
  const end = Date.parse(session.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return "SESSION_NOT_JOINABLE";
  if (now >= end) return "SESSION_ENDED";
  if (!["CONFIRMED", "READY", "ONGOING"].includes(session.status))
    return "SESSION_NOT_JOINABLE";
  if (now < start - sessionEarlyJoinMs) return "JOIN_WINDOW_NOT_OPEN";
  const join = session.join;
  if (!join?.canJoin) return join?.reason ?? "JOIN_STATUS_UNAVAILABLE";
  const opens = Date.parse(join.opensAt ?? "");
  const closes = Date.parse(join.closesAt ?? "");
  if (!Number.isFinite(opens) || !Number.isFinite(closes) || closes <= opens)
    return "JOIN_STATUS_UNAVAILABLE";
  if (now < opens) return "JOIN_WINDOW_NOT_OPEN";
  if (now >= closes) return "JOIN_WINDOW_CLOSED";
  return null;
}
export function canJoinSession(session?: JoinSession, now = Date.now()) {
  return sessionJoinReason(session, now) === null;
}
