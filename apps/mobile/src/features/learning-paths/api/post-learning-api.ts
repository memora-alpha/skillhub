import { z } from "zod";
import { AppError } from "@/lib/http/errors";
import { parse, resourcePath, version, uuid } from "@/lib/http/contracts";
import type { RequestOptions } from "@/lib/http/client";
import { changeSchema } from "./post-learning-contracts";

export function createPostLearningApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  const changes = (pathId: string, sessionId?: string) =>
    sessionId
      ? `${resourcePath("sessions", sessionId)}/cancellation-requests`
      : `${resourcePath("learning-paths", pathId)}/termination-requests`;
  const verify = <T extends { pathId: string }>(row: T, pathId: string) => {
    if (row.pathId !== pathId) throw new AppError("protocol");
    return row;
  };
  return {
    async changes(pathId: string, sessionId?: string, signal?: AbortSignal) {
      const rows = parse(
        z.array(changeSchema).max(100),
        await call(changes(pathId, sessionId), { signal }),
      );
      rows.forEach((row) => {
        verify(row, pathId);
        if (
          (sessionId && row.sessionId !== sessionId) ||
          row.kind !== (sessionId ? "SESSION_CANCELLATION" : "PATH_TERMINATION")
        )
          throw new AppError("protocol");
      });
      return rows;
    },
    async requestChange(
      pathId: string,
      sessionId: string | undefined,
      key: string,
      body: { reason: string; expectedStartAt?: string },
    ) {
      const payload = parse(
        z
          .object({
            reason: z.string().trim().min(3).max(1000),
            ...(sessionId
              ? { expectedStartAt: z.iso.datetime({ offset: true }) }
              : {}),
          })
          .strict(),
        body,
      );
      const row = verify(
        parse(
          changeSchema,
          await call(changes(pathId, sessionId), {
            method: "POST",
            body: payload,
            idempotencyKey: parse(uuid, key),
            replayAfterRenewal: false,
          }),
        ),
        pathId,
      );
      if (sessionId && row.sessionId !== sessionId)
        throw new AppError("protocol");
      return row;
    },
    async respond(
      pathId: string,
      sessionId: string | undefined,
      id: string,
      expectedVersion: number,
      action: "withdraw" | "response" | "escalate",
      input: { accept?: boolean; note?: string; reason?: string } = {},
    ) {
      const schema = z
        .object({
          expectedVersion: version,
          ...(action === "response"
            ? {
                accept: z.boolean(),
                note: z.string().trim().max(1000).optional(),
              }
            : {}),
          ...(action === "escalate"
            ? { reason: z.string().trim().min(3).max(1000) }
            : {}),
        })
        .strict();
      const body = parse(schema, { expectedVersion, ...input });
      const row = verify(
        parse(
          changeSchema,
          await call(
            `${changes(pathId, sessionId)}/${parse(uuid, id)}/${action}`,
            { method: "POST", body, replayAfterRenewal: false },
          ),
        ),
        pathId,
      );
      if (row.id !== id) throw new AppError("protocol");
      return row;
    },
  };
}
