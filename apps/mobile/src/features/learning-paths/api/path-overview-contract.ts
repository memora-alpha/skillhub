import { z } from "zod";
import { timestamp, uuid } from "@/lib/http/contracts";
import { pathTarget } from "./path-target-contract";
import { settlementStatus } from "./path-changes-contract";

export const pathAttention = z.object({
  key: z.string().min(1),
  type: z.string().min(1),
  reasonCode: z.string(),
  status: z.string().min(1),
  waitingOn: z.string().min(1),
  sessionId: uuid.nullable(),
  deadline: timestamp.nullable(),
  blocksSettlement: z.boolean(),
  target: pathTarget,
  allowedActions: z.array(
    z.object({ code: z.string().min(1), target: pathTarget }),
  ),
});
const progressCount = z
  .object({
    completed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
  .refine((row) => row.completed <= row.total);
export const overviewCard = z.object({
  evaluatedAt: timestamp,
  learningStage: z
    .enum([
      "PREPARING",
      "WAITING_START",
      "LEARNING",
      "LEARNING_FINISHED",
      "COMPLETED",
      "STOPPED",
    ])
    .nullable(),
  stageReasonCode: z.string().nullable(),
  progress: z.object({
    learning: progressCount.nullable(),
    teaching: progressCount.nullable(),
    basis: z.enum(["LOCKED_AGREEMENT", "CURRENT_PLAN"]),
  }),
  nextSession: z
    .object({
      id: uuid,
      planId: uuid,
      startAt: timestamp,
      endAt: timestamp,
      role: z.enum(["TEACHER", "LEARNER"]),
      status: z.string().min(1),
    })
    .refine((row) => Date.parse(row.endAt) > Date.parse(row.startAt))
    .nullable(),
  attentionCount: z.number().int().nonnegative(),
  primaryAttention: pathAttention.nullable(),
  primaryAction: z.object({ code: z.string().min(1), target: pathTarget }),
  settlement: settlementStatus,
});
export const pathOverview = overviewCard
  .extend({
    attentionItems: z.array(pathAttention),
  })
  .superRefine((row, ctx) => {
    if (
      row.attentionItems.length !== row.attentionCount ||
      new Set(row.attentionItems.map((item) => item.key)).size !==
        row.attentionItems.length ||
      (row.primaryAttention?.key ?? null) !==
        (row.attentionItems[0]?.key ?? null)
    )
      ctx.addIssue({ code: "custom", message: "Inconsistent path attention" });
  });
export const participantCase = z.object({
  id: uuid,
  relatedPathId: uuid,
  relatedSessionId: uuid.nullable(),
  reasonCode: z.string(),
  status: z.string().min(1),
  blocksSettlement: z.boolean(),
  createdAt: timestamp.nullable(),
  resolvedAt: timestamp.nullable(),
});
export const participantCaseSummary = participantCase.extend({
  attention: pathAttention.nullable(),
});
export type PathOverviewCard = z.infer<typeof overviewCard>;
export type PathOverview = z.infer<typeof pathOverview>;
export type PathAttention = z.infer<typeof pathAttention>;
export type ParticipantCase = z.infer<typeof participantCase>;
