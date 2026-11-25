import { z } from "zod";
import {
  sessionJoinAccess,
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

export type WhiteboardAccess = {
  readOnly: boolean;
  /** Join-window reason codes; null while the board is editable. */
  readOnlyReason: string | null;
};

/**
 * The board is editable exactly while participants may be in the room
 * ([startAt - early, endAt + late) on a joinable status). Persistence does not
 * depend on LiveKit availability, so the provider flag is not considered.
 */
export function whiteboardAccess(
  session: SessionTiming,
  now: Date,
  policy: JoinWindowPolicy | null,
): WhiteboardAccess {
  const access = sessionJoinAccess(session, now, policy, true);
  return { readOnly: !access.canJoin, readOnlyReason: access.reason };
}
