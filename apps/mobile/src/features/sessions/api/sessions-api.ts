import { z } from "zod";
import type { HttpClient, RequestOptions } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import { liveKitTokenSchema } from "./livekit-contract";
import {
  sessionSchema,
  completionReceiptSchema,
  type SessionRange,
} from "../types";

function sessionPath(id: string) {
  if (!z.uuid().safeParse(id).success) throw new AppError("protocol");
  return `/sessions/${encodeURIComponent(id)}`;
}

export function createSessionsApi(
  client: HttpClient,
  userId: string,
  isCurrent = () => true,
) {
  async function call(path: string, options: RequestOptions = {}) {
    if (!isCurrent()) throw new AppError("session");
    const result = await client.request(path, {
      ...options,
      authenticated: true,
    });
    if (!isCurrent()) throw new AppError("session");
    return result;
  }
  function parse(value: unknown, id?: string, list = false) {
    const result = sessionSchema.safeParse(value);
    if (!result.success || (id && result.data.id !== id))
      throw new AppError("protocol");
    const s = result.data;
    if (userId !== s.teacherId && userId !== s.learnerId)
      throw new AppError("http", 403, "SESSION_ACCESS_DENIED");
    const role: "TEACHER" | "LEARNER" =
      userId === s.teacherId ? "TEACHER" : "LEARNER";
    if ((list && !s.role) || (s.role && s.role !== role))
      throw new AppError("protocol");
    return { ...s, role };
  }
  return {
    async list(range: SessionRange, signal?: AbortSignal) {
      const result = await call(
        `/sessions/mine?${new URLSearchParams(range)}`,
        { signal },
      );
      if (!Array.isArray(result)) throw new AppError("protocol");
      return result.map((value) => parse(value, undefined, true));
    },
    async detail(id: string, signal?: AbortSignal) {
      return parse(await call(sessionPath(id), { signal }), id);
    },
    async liveKitToken(id: string, signal?: AbortSignal) {
      const result = liveKitTokenSchema.safeParse(
        await call(`${sessionPath(id)}/livekit-token`, {
          method: "POST",
          body: {},
          signal,
          replayAfterRenewal: false,
        }),
      );
      if (
        !result.success ||
        result.data.participantIdentity !== `${id}:${userId}`
      )
        throw new AppError("protocol");
      return result.data;
    },
    async complete(id: string, note = "") {
      if (note.length > 1000) throw new AppError("protocol");
      const result = completionReceiptSchema.safeParse(
        await call(`${sessionPath(id)}/confirm-completion`, {
          method: "POST",
          body: note ? { note } : {},
          replayAfterRenewal: false,
        }),
      );
      if (!result.success || result.data.id !== id)
        throw new AppError("protocol");
      return result.data;
    },
  };
}
export type SessionsApi = ReturnType<typeof createSessionsApi>;
