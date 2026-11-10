import { z } from "zod";
import { uuid, timestamp, version } from "@/lib/http/contracts";
export const changeSchema = z.object({
  id: uuid,
  pathId: uuid,
  sessionId: uuid.nullable(),
  kind: z.enum(["SESSION_CANCELLATION", "PATH_TERMINATION"]),
  status: z.enum([
    "PENDING",
    "ACCEPTED",
    "STAFF_REVIEW",
    "REJECTED",
    "WITHDRAWN",
    "EXPIRED",
    "APPLIED",
  ]),
  version,
  requesterId: uuid,
  reason: z.string(),
  createdAt: timestamp,
  expiresAt: timestamp,
  responseNote: z.string().nullable(),
  blockedByDispute: z.boolean(),
  awaitingPolicy: z.boolean(),
  resolution: z
    .object({
      outcome: z.string().optional(),
      creditPenalty: z.string().optional(),
    })
    .passthrough()
    .nullable(),
});
export type LearningChange = z.infer<typeof changeSchema>;
