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
export const settlementStatusSchema = z.object({
  pathId: uuid,
  status: z.enum([
    "SETTLED",
    "TERMINATED",
    "NOT_LOCKED",
    "WAITING_TERMINATION",
    "WAITING_DISPUTE",
    "WAITING_SESSIONS",
    "NEEDS_REVIEW",
    "WAITING_DISPUTE_WINDOW",
    "RETRYING",
    "READY",
  ]),
  reasonCode: z.string().nullable(),
  nextAction: z.string(),
  settledAt: timestamp.nullable(),
  lastCheckedAt: timestamp.nullable(),
  attemptCount: z.number().int().nonnegative(),
  retryable: z.boolean(),
  pathVersion: version.nullable(),
  autoSettlementAt: timestamp.nullable(),
  immediateSettlement: z.object({
    ownApprovedAt: timestamp.nullable(),
    partnerApprovedAt: timestamp.nullable(),
    canApprove: z.boolean(),
  }),
});
export const settlementConsentSchema = z.object({
  pathId: uuid,
  approvedAt: timestamp,
  bothApproved: z.boolean(),
  settlement: z.object({
    outcome: z.enum(["SETTLED", "WAITING", "RETRYING", "NEEDS_REVIEW"]),
    errorCode: z.string().optional(),
  }),
});
export type LearningChange = z.infer<typeof changeSchema>;
export type SettlementStatus = z.infer<typeof settlementStatusSchema>;
