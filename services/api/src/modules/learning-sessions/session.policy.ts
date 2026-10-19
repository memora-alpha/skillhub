import type { Session } from "../../generated/prisma/client";

export type JoinWindowPolicy = { earlyMinutes: number; lateMinutes: number };
export type SessionTiming = Pick<Session, "status" | "startAt" | "endAt">;
export type SessionJoinAccess = {
  canJoin: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
  reason: string | null;
};

const joinable = new Set([
  "CONFIRMED",
  "READY",
  "ONGOING",
  "AWAITING_CONFIRMATION",
]);

export function sessionJoinWindow(
  startAt: Date,
  endAt: Date,
  policy: JoinWindowPolicy,
) {
  const opensAt = new Date(+startAt - policy.earlyMinutes * 60_000);
  const closesAt = new Date(+endAt + policy.lateMinutes * 60_000);
  if (
    !Number.isFinite(+startAt) ||
    !Number.isFinite(+endAt) ||
    startAt >= endAt ||
    ![policy.earlyMinutes, policy.lateMinutes].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) ||
    !Number.isFinite(+opensAt) ||
    !Number.isFinite(+closesAt)
  )
    throw new TypeError("INVALID_SESSION_JOIN_WINDOW");
  return { opensAt, closesAt };
}

export function sessionStatusAt(
  session: SessionTiming,
  now: Date,
  policy: JoinWindowPolicy | null,
): Session["status"] {
  if (!joinable.has(session.status)) return session.status;
  if (now >= session.endAt) return "AWAITING_CONFIRMATION";
  if (session.status === "ONGOING") return "ONGOING";
  const { opensAt } = safeWindow(session, policy);
  if (opensAt && now >= opensAt) return "READY";
  return "CONFIRMED";
}

export function sessionJoinAccess(
  session: SessionTiming,
  now: Date,
  policy: JoinWindowPolicy | null,
  enabled: boolean,
): SessionJoinAccess {
  let reason: string | null = null;
  const window = safeWindow(session, policy);
  if (!enabled) reason = "LIVEKIT_DISABLED";
  else if (!joinable.has(session.status)) reason = "SESSION_NOT_JOINABLE";
  else if (!window.opensAt || !window.closesAt)
    reason = "LIVEKIT_POLICY_NOT_READY";
  else if (now < window.opensAt) reason = "JOIN_WINDOW_NOT_OPEN";
  else if (now >= window.closesAt) reason = "JOIN_WINDOW_CLOSED";
  return { ...window, canJoin: reason === null, reason };
}

function safeWindow(session: SessionTiming, policy: JoinWindowPolicy | null) {
  try {
    if (policy)
      return sessionJoinWindow(session.startAt, session.endAt, policy);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
  }
  return { opensAt: null, closesAt: null };
}

export function sessionParticipantIdentity(sessionId: string, userId: string) {
  return `${sessionId}:${userId}`;
}
