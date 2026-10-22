import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import {
  parse,
  resourcePath,
  timestamp,
  uuid,
  version,
} from "@/lib/http/contracts";
import { AppError } from "@/lib/http/errors";

export const sessionStatus = z.enum([
  "CONFIRMED",
  "READY",
  "ONGOING",
  "AWAITING_CONFIRMATION",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
]);
const confirmation = z.literal("CONFIRMED").nullable();
const joinSchema = z.object({
  canJoin: z.boolean(),
  opensAt: timestamp.nullable(),
  closesAt: timestamp.nullable(),
  reason: z.string().nullable(),
});
const sessionSchema = z.object({
  id: uuid,
  pathId: uuid,
  planId: uuid,
  teacherId: uuid,
  learnerId: uuid,
  startAt: timestamp,
  endAt: timestamp,
  status: sessionStatus,
  teacherConfirmationStatus: confirmation,
  learnerConfirmationStatus: confirmation,
  role: z.enum(["TEACHER", "LEARNER"]),
  join: joinSchema,
});
const progress = z
  .object({
    total: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
  })
  .refine((value) => value.completed <= value.total);
const detailSchema = sessionSchema.extend({
  planVersion: version,
  outlineSessionNo: version,
  teacherConfirmedAt: timestamp.nullable(),
  learnerConfirmedAt: timestamp.nullable(),
  teacherConfirmationNote: z.string().nullable(),
  learnerConfirmationNote: z.string().nullable(),
  progress: z.object({ agreement: progress, plan: progress }),
});
export type ApiSession = z.infer<typeof sessionSchema>;
export type ApiSessionDetail = z.infer<typeof detailSchema>;
export type SessionRange = { from: string; to: string };

function assertSession(session: ApiSession, userId: string) {
  const participant =
    session.role === "TEACHER" ? session.teacherId : session.learnerId;
  if (
    participant !== userId ||
    session.teacherId === session.learnerId ||
    Date.parse(session.endAt) <= Date.parse(session.startAt)
  )
    throw new AppError("protocol");
}

export function createSessionsApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
  userId: string,
) {
  return {
    async mine(range: SessionRange, signal?: AbortSignal) {
      parse(z.object({ from: timestamp, to: timestamp }), range);
      if (Date.parse(range.from) > Date.parse(range.to))
        throw new AppError("protocol");
      const query = new URLSearchParams(range);
      const items = parse(
        z.array(sessionSchema).max(100),
        await call(`/sessions/mine?${query}`, { signal }),
      );
      if (new Set(items.map((item) => item.id)).size !== items.length)
        throw new AppError("protocol");
      for (const item of items) {
        assertSession(item, userId);
        if (
          Date.parse(item.startAt) < Date.parse(range.from) ||
          Date.parse(item.startAt) > Date.parse(range.to)
        )
          throw new AppError("protocol");
      }
      return items;
    },
    async detail(id: string, signal?: AbortSignal) {
      const session = parse(
        detailSchema,
        await call(resourcePath("sessions", id), { signal }),
      );
      assertSession(session, userId);
      if (session.id !== id) throw new AppError("protocol");
      return session;
    },
    async complete(id: string) {
      const result = parse(
        z.object({ id: uuid, status: sessionStatus }),
        await call(`${resourcePath("sessions", id)}/confirm-completion`, {
          method: "POST",
          body: { note: "" },
          replayAfterRenewal: false,
        }),
      );
      if (
        result.id !== id ||
        !["AWAITING_CONFIRMATION", "COMPLETED"].includes(result.status)
      )
        throw new AppError("protocol");
      return result;
    },
  };
}
