import {
  sessionJoinWindow,
  sessionStatusAt,
  type JoinWindowPolicy,
  type SessionTiming,
} from "./session.policy";

/** Spec 020 status machine. Values match the `SessionRecordingStatus` enum. */
export const RECORDING_STATUSES = [
  "REQUESTED",
  "DECLINED",
  "REQUEST_EXPIRED",
  "STARTING",
  "RECORDING",
  "STOPPING",
  "READY",
  "FAILED",
  "EXPIRED",
  "DELETED",
] as const;
export type RecordingStatus = (typeof RECORDING_STATUSES)[number];
export type RecordingKind = "ROOM_COMPOSITE_VIDEO" | "AUDIO_ONLY";
export type RecordingStopReason =
  | "PARTICIPANT"
  | "WINDOW_CLOSED"
  | "ROOM_FINISHED"
  | "MAX_DURATION"
  | "DISABLED";

/** At most one row per Session in these statuses (partial unique index). */
export const ACTIVE_RECORDING_STATUSES = [
  "REQUESTED",
  "STARTING",
  "RECORDING",
  "STOPPING",
] as const satisfies readonly RecordingStatus[];

/** An unanswered request expires after this long (spec D2). */
export const RECORDING_REQUEST_TTL_MS = 2 * 60_000;

const transitions: Record<RecordingStatus, readonly RecordingStatus[]> = {
  REQUESTED: ["STARTING", "DECLINED", "REQUEST_EXPIRED"],
  // A lost egress_started still lets egress_ended finish the row.
  STARTING: ["RECORDING", "STOPPING", "READY", "FAILED"],
  RECORDING: ["STOPPING", "READY", "FAILED"],
  STOPPING: ["READY", "FAILED"],
  READY: ["EXPIRED", "DELETED"],
  DECLINED: [],
  REQUEST_EXPIRED: [],
  FAILED: [],
  EXPIRED: [],
  DELETED: [],
};

export function canTransition(from: RecordingStatus, to: RecordingStatus) {
  return transitions[from].includes(to);
}

export function isActiveRecording(status: RecordingStatus) {
  return (ACTIVE_RECORDING_STATUSES as readonly string[]).includes(status);
}

export type RecordingRequestCheck =
  | { allowed: true; closesAt: Date }
  | {
      allowed: false;
      reason: "RECORDING_WINDOW_NOT_OPEN" | "RECORDING_POLICY_NOT_READY";
    };

function joinWindow(session: SessionTiming, policy: JoinWindowPolicy) {
  try {
    return sessionJoinWindow(session.startAt, session.endAt, policy);
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

/**
 * Spec D3: a request is allowed while the room is open and the Session is READY or ONGOING at
 * `now`, using the same effective status the room uses.
 */
export function recordingRequestCheck(
  session: SessionTiming,
  now: Date,
  policy: JoinWindowPolicy | null,
): RecordingRequestCheck {
  const window = policy ? joinWindow(session, policy) : null;
  if (!window) return { allowed: false, reason: "RECORDING_POLICY_NOT_READY" };
  const status = sessionStatusAt(session, now, policy);
  const open = now >= window.opensAt && now < window.closesAt;
  if (!open || (status !== "READY" && status !== "ONGOING"))
    return { allowed: false, reason: "RECORDING_WINDOW_NOT_OPEN" };
  return { allowed: true, closesAt: window.closesAt };
}

/**
 * Spec D3: a running recording stops at the earlier of the join window close and its cap, the
 * Session length plus `overrunMinutes` counted from when Egress started.
 */
export function recordingStopDeadline(
  session: SessionTiming,
  startedAt: Date,
  policy: JoinWindowPolicy,
  overrunMinutes: number,
): { at: Date; reason: "WINDOW_CLOSED" | "MAX_DURATION" } | null {
  const window = joinWindow(session, policy);
  if (!window || !Number.isSafeInteger(overrunMinutes) || overrunMinutes < 0)
    return null;
  const length = +session.endAt - +session.startAt;
  const cap = new Date(+startedAt + length + overrunMinutes * 60_000);
  if (!Number.isFinite(+cap)) return null;
  return cap < window.closesAt
    ? { at: cap, reason: "MAX_DURATION" }
    : { at: window.closesAt, reason: "WINDOW_CLOSED" };
}

export function recordingRequestExpired(requestedAt: Date, now: Date) {
  return +now - +requestedAt >= RECORDING_REQUEST_TTL_MS;
}

/** Spec D6: the earliest moment a READY recording may expire; an open report delays it. */
export function recordingExpiresAt(endAt: Date, retentionDays: number) {
  return new Date(+endAt + retentionDays * 86_400_000);
}

export type RecordingParty = {
  teacherId: string;
  learnerId: string;
};

export type RecordingActorError =
  "SESSION_ACCESS_DENIED" | "RECORDING_ACTION_NOT_ALLOWED";

/** Only the participant who did not request may accept or decline (spec D2). */
export function responderError(
  session: RecordingParty,
  recording: { requestedByUserId: string },
  actorId: string,
): RecordingActorError | null {
  if (actorId !== session.teacherId && actorId !== session.learnerId)
    return "SESSION_ACCESS_DENIED";
  if (actorId === recording.requestedByUserId)
    return "RECORDING_ACTION_NOT_ALLOWED";
  return null;
}

/** The object key Egress writes and the API signs and deletes. */
export function recordingObjectKey(sessionId: string, recordingId: string) {
  return `recordings/${sessionId}/${recordingId}.mp4`;
}
