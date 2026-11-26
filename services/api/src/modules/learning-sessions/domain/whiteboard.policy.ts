import { z } from "zod";
import {
  sessionJoinWindow,
  type JoinWindowPolicy,
  type SessionTiming,
} from "./session.policy";

/** Upper bound for one persisted scene, measured as UTF-8 JSON bytes. */
export const WHITEBOARD_MAX_SCENE_BYTES = 2 * 1024 * 1024;
export const WHITEBOARD_MAX_ELEMENTS = 20_000;
/** Route body limit: the scene plus the small request envelope. */
export const WHITEBOARD_BODY_LIMIT_BYTES = WHITEBOARD_MAX_SCENE_BYTES + 4096;

// Only the fields the server relies on are checked; Excalidraw owns the rest.
const elementSchema = z.looseObject({
  id: z.string().min(1).max(128),
  type: z.string().min(1).max(64),
  version: z.number().int().nonnegative(),
  versionNonce: z.number().int(),
  isDeleted: z.boolean().optional(),
});

export const whiteboardSceneSchema = z.strictObject({
  elements: z.array(elementSchema).max(WHITEBOARD_MAX_ELEMENTS),
  appState: z.record(z.string(), z.unknown()).optional(),
  files: z.record(z.string(), z.unknown()).optional(),
});

export type WhiteboardScene = z.infer<typeof whiteboardSceneSchema>;

export type WhiteboardSceneCheck =
  | { ok: true; scene: WhiteboardScene; bytes: number }
  | {
      ok: false;
      code: "INVALID_WHITEBOARD_SCENE" | "WHITEBOARD_SCENE_TOO_LARGE";
    };

export function checkWhiteboardScene(input: unknown): WhiteboardSceneCheck {
  const parsed = whiteboardSceneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_WHITEBOARD_SCENE" };
  const ids = new Set(parsed.data.elements.map((element) => element.id));
  if (ids.size !== parsed.data.elements.length)
    return { ok: false, code: "INVALID_WHITEBOARD_SCENE" };
  const bytes = Buffer.byteLength(JSON.stringify(parsed.data), "utf8");
  if (bytes > WHITEBOARD_MAX_SCENE_BYTES)
    return { ok: false, code: "WHITEBOARD_SCENE_TOO_LARGE" };
  return { ok: true, scene: parsed.data, bytes };
}

/** Report statuses that let Staff read a board and that hold it from deletion. */
export const WHITEBOARD_HOLD_REPORT_STATUSES = [
  "OPEN",
  "UNDER_REVIEW",
  "NEED_MORE_INFO",
] as const;

/** Sessions a report case points at, either as its target or as related context. */
export function reportedSessionIds(item: {
  relatedSessionId: string | null;
  targetType: string;
  targetId: string;
}): string[] {
  const ids = item.relatedSessionId ? [item.relatedSessionId] : [];
  if (item.targetType === "SESSION") ids.push(item.targetId);
  return ids;
}

export type WhiteboardEditPolicy = {
  teacherPrepare: boolean;
  afterEndMinutes: number;
};
export type WhiteboardRole = "TEACHER" | "LEARNER";

export type WhiteboardReadOnlyReason =
  | "SESSION_NOT_EDITABLE"
  | "SESSION_UNDER_REPORT"
  | "WHITEBOARD_POLICY_NOT_READY"
  | "EDIT_WINDOW_NOT_OPEN"
  | "EDIT_WINDOW_CLOSED";

export type WhiteboardAccess = {
  readOnly: boolean;
  /** Null while the board is editable. */
  readOnlyReason: WhiteboardReadOnlyReason | null;
  /** Null when the actor may edit from confirmation (teacher preparation). */
  editableFrom: Date | null;
  editableUntil: Date | null;
};

// A disputed, cancelled or no-show Session freezes the board as evidence.
const editableStatuses = new Set<string>([
  "CONFIRMED",
  "READY",
  "ONGOING",
  "AWAITING_CONFIRMATION",
  "COMPLETED",
]);

function editWindow(
  session: SessionTiming,
  role: WhiteboardRole,
  joinPolicy: JoinWindowPolicy,
  editPolicy: WhiteboardEditPolicy,
) {
  const { afterEndMinutes, teacherPrepare } = editPolicy;
  if (!Number.isSafeInteger(afterEndMinutes) || afterEndMinutes < 0)
    return null;
  let join;
  try {
    join = sessionJoinWindow(session.startAt, session.endAt, joinPolicy);
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
  const graceEnd = +session.endAt + afterEndMinutes * 60_000;
  const closesAt = new Date(Math.max(+join.closesAt, graceEnd));
  if (!Number.isFinite(+closesAt)) return null;
  const opensAt = role === "TEACHER" && teacherPrepare ? null : join.opensAt;
  return { opensAt, closesAt };
}

/**
 * Spec 019 P1: both participants edit from the room join window opening until
 * max(join window close, endAt + afterEndMinutes); with teacherPrepare the
 * teacher may also edit from confirmation. Afterwards the board is read-only.
 * An open report on the Session freezes the board so the evidence Staff
 * reviews cannot change (SESSION_UNDER_REPORT).
 */
export function whiteboardAccess(
  session: SessionTiming,
  role: WhiteboardRole,
  now: Date,
  joinPolicy: JoinWindowPolicy | null,
  editPolicy: WhiteboardEditPolicy | null,
  underReport = false,
): WhiteboardAccess {
  const closed = (reason: WhiteboardReadOnlyReason): WhiteboardAccess => ({
    readOnly: true,
    readOnlyReason: reason,
    editableFrom: null,
    editableUntil: null,
  });
  if (!editableStatuses.has(session.status))
    return closed("SESSION_NOT_EDITABLE");
  if (underReport) return closed("SESSION_UNDER_REPORT");
  const window =
    joinPolicy && editPolicy
      ? editWindow(session, role, joinPolicy, editPolicy)
      : null;
  if (!window) return closed("WHITEBOARD_POLICY_NOT_READY");
  let reason: WhiteboardReadOnlyReason | null = null;
  if (window.opensAt && now < window.opensAt) reason = "EDIT_WINDOW_NOT_OPEN";
  else if (now >= window.closesAt) reason = "EDIT_WINDOW_CLOSED";
  return {
    readOnly: reason !== null,
    readOnlyReason: reason,
    editableFrom: window.opensAt,
    editableUntil: window.closesAt,
  };
}
