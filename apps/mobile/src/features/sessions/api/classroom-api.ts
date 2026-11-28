import { z } from "zod";
import { AppError } from "@/lib/http/errors";
import type { RequestOptions } from "@/lib/http/client";
import {
  boardSceneSchema,
  whiteboardSchema,
  savedBoardSchema,
  recordingSchema,
  recordingListSchema,
  playbackSchema,
  type BoardScene,
} from "./classroom-contracts";

export type RecordingAction =
  "request" | "accept" | "decline" | "stop" | "delete";
const uuid = (value: string) => {
  if (!z.uuid().safeParse(value).success) throw new AppError("protocol");
  return encodeURIComponent(value);
};
function read<T>(schema: z.ZodType<T>, value: unknown): T {
  const checked = schema.safeParse(value);
  if (!checked.success) throw new AppError("protocol");
  return checked.data;
}
export function createClassroomApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  const base = (id: string) => `/sessions/${uuid(id)}`;
  return {
    async whiteboard(id: string, signal?: AbortSignal) {
      return read(
        whiteboardSchema,
        await call(`${base(id)}/whiteboard`, { signal }),
      );
    },
    async saveWhiteboard(
      id: string,
      expectedRevision: number,
      sceneData: BoardScene,
    ) {
      if (
        !Number.isInteger(expectedRevision) ||
        expectedRevision < 0 ||
        expectedRevision >= 2_147_483_647
      )
        throw new AppError("protocol");
      const scene = read(boardSceneSchema, sceneData);
      if (
        new TextEncoder().encode(JSON.stringify(scene)).byteLength >
        2 * 1024 * 1024
      )
        throw new AppError("http", 413, "WHITEBOARD_SCENE_TOO_LARGE");
      const saved = read(
        savedBoardSchema,
        await call(`${base(id)}/whiteboard`, {
          method: "PUT",
          body: { expectedRevision, sceneData: scene },
          replayAfterRenewal: false,
        }),
      );
      if (saved.revision !== expectedRevision + 1)
        throw new AppError("protocol");
      return saved;
    },
    async recordings(id: string, signal?: AbortSignal) {
      const list = read(
        recordingListSchema,
        await call(`${base(id)}/recordings`, { signal }),
      );
      if (
        list.items.some((row) => row.sessionId !== id) ||
        new Set(list.items.map((row) => row.id)).size !== list.items.length
      )
        throw new AppError("protocol");
      return list.items;
    },
    async recordingAction(
      id: string,
      action: RecordingAction,
      recordingId?: string,
    ) {
      const suffix =
        action === "request"
          ? ""
          : `/${uuid(recordingId ?? "")}` +
            (action === "delete" ? "" : `/${action}`);
      const row = read(
        recordingSchema,
        await call(`${base(id)}/recordings${suffix}`, {
          method: action === "delete" ? "DELETE" : "POST",
          replayAfterRenewal: false,
        }),
      );
      if (
        row.sessionId !== id ||
        (action !== "request" && row.id !== recordingId)
      )
        throw new AppError("protocol");
      return row;
    },
    async recordingPlayback(id: string, recordingId: string) {
      return read(
        playbackSchema,
        await call(`${base(id)}/recordings/${uuid(recordingId)}/playback`),
      );
    },
  };
}
