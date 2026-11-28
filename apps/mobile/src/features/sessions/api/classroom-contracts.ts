import { z } from "zod";

const instant = z.iso.datetime({ offset: true });
const count = z.number().int().nonnegative().safe();
const coordinate = z.number().finite();
export const boardElementSchema = z
  .object({
    id: z.string().min(1).max(128),
    type: z.string().min(1).max(64),
    version: count,
    versionNonce: z.number().int().safe(),
    isDeleted: z.boolean().optional(),
    x: coordinate.optional(),
    y: coordinate.optional(),
    width: coordinate.optional(),
    height: coordinate.optional(),
    strokeColor: z.string().max(128).optional(),
    strokeWidth: z.number().finite().nonnegative().optional(),
    points: z
      .array(z.tuple([coordinate, coordinate]))
      .max(20_000)
      .optional(),
    text: z.string().max(100_000).optional(),
    fontSize: z.number().finite().positive().optional(),
  })
  .catchall(z.unknown());
export const boardSceneSchema = z
  .object({
    elements: z
      .array(boardElementSchema)
      .max(20_000)
      .refine(
        (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
      ),
    appState: z.record(z.string(), z.unknown()).optional(),
    files: z.record(z.string(), z.unknown()).optional(),
  })
  .catchall(z.unknown());
export const whiteboardSchema = z.object({
  revision: count.max(2_147_483_647),
  sceneData: boardSceneSchema.nullable(),
  updatedAt: instant.nullable(),
  updatedByUserId: z.uuid().nullable(),
  retentionDays: count.nullable(),
  readOnly: z.boolean(),
  readOnlyReason: z.string().nullable(),
  editableFrom: instant.nullable(),
  editableUntil: instant.nullable(),
});
export const savedBoardSchema = z.object({
  revision: count.positive(),
  updatedAt: instant,
});
export const recordingStatuses = [
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
export const recordingSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  status: z.enum(recordingStatuses),
  kind: z.enum(["ROOM_COMPOSITE_VIDEO", "AUDIO_ONLY"]),
  requestedByUserId: z.uuid(),
  acceptedByUserId: z.uuid().nullable(),
  requestedAt: instant,
  startedAt: instant.nullable(),
  endedAt: instant.nullable(),
  durationMs: count.nullable(),
  bytes: count.nullable(),
  stopReason: z.string().nullable(),
  retentionDays: count.nullable(),
  expiresAt: instant.nullable(),
  heldByReport: z.boolean(),
  deletedAt: instant.nullable(),
});
export const recordingListSchema = z.object({
  items: z.array(recordingSchema),
});
export const playbackSchema = z.object({
  url: z.url().refine((value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    );
  }),
  expiresAt: instant.refine((value) => Date.parse(value) > Date.now()),
  mime: z.enum(["video/mp4", "audio/mp4"]),
});
export type BoardElement = z.infer<typeof boardElementSchema>;
export type BoardScene = z.infer<typeof boardSceneSchema>;
export type Whiteboard = z.infer<typeof whiteboardSchema>;
export type SessionRecording = z.infer<typeof recordingSchema>;
export type RecordingPlayback = z.infer<typeof playbackSchema>;
