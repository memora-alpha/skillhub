import { z } from "zod";
import { timestamp, uuid, version } from "@/lib/http/contracts";

const credit = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/);
export const changeReason = z.string().trim().min(3).max(1000);
export const terminationResolution = z.object({
  policyReference: z.string().min(1),
  reason: z.string(),
  allocations: z
    .array(
      z.object({
        allocationId: uuid,
        refund: credit,
        counterpartyPayment: credit,
        platformFee: credit,
      }),
    )
    .min(1)
    .max(2),
});
export const terminationRequest = z
  .object({
    id: uuid,
    pathId: uuid,
    sessionId: z.null(),
    kind: z.literal("PATH_TERMINATION"),
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
    responderId: uuid.nullable(),
    respondedAt: timestamp.nullable(),
    accepted: z.boolean().nullable(),
    responseNote: z.string().nullable(),
    closedAt: timestamp.nullable(),
    operationId: uuid.nullable(),
    resolution: z
      .union([
        terminationResolution,
        z.object({ outcome: z.literal("REJECTED"), reason: z.string() }),
      ])
      .nullable(),
    blockedByDispute: z.boolean(),
    awaitingPolicy: z.boolean(),
  })
  .superRefine((row, ctx) => {
    if (
      row.status === "APPLIED" &&
      (!row.operationId ||
        !terminationResolution.safeParse(row.resolution).success)
    )
      ctx.addIssue({ code: "custom", message: "Missing termination decision" });
  });

export const settlementStatus = z.object({
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
  pathVersion: version.nullable().optional(),
  autoSettlementAt: timestamp.nullable().optional(),
  immediateSettlement: z
    .object({
      ownApprovedAt: timestamp.nullable(),
      partnerApprovedAt: timestamp.nullable(),
      canApprove: z.boolean(),
    })
    .optional(),
});
export const settlementConsentReceipt = z.object({
  pathId: uuid,
  approvedAt: timestamp.nullable(),
  bothApproved: z.boolean(),
  settlement: z.object({
    outcome: z.enum(["SETTLED", "WAITING", "RETRYING", "NEEDS_REVIEW"]),
    errorCode: z.string().optional(),
  }),
});
export type TerminationRequest = z.infer<typeof terminationRequest>;
export type SettlementStatus = z.infer<typeof settlementStatus>;
