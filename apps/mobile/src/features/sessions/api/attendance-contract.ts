import { z } from "zod";

const date = z.iso.datetime({ offset: true }).nullable();
const side = z.object({
  verdict: z.enum(["PRESENT", "ABSENT", "UNVERIFIABLE"]).nullable(),
  late: z.boolean(),
  seconds: z.string().regex(/^\d+$/),
  firstJoinedAt: date,
});
export const sessionAction = z.enum([
  "JOIN",
  "CONFIRM_COMPLETION",
  "SUBMIT_EXCUSE",
  "DECIDE_EXCUSE",
  "REPORT_NO_SHOW",
  "PROPOSE_MAKEUP",
]);
// List responses contain only state; detail supplies both participant records.
export const attendanceSchema = z.object({
  state: z.enum(["PENDING_DATA", "DETERMINED", "UNVERIFIABLE"]).nullable(),
  case: z
    .enum([
      "BOTH_PRESENT",
      "TEACHER_ABSENT",
      "LEARNER_ABSENT",
      "BOTH_ABSENT",
      "UNVERIFIABLE",
    ])
    .nullable()
    .optional(),
  teacher: side.optional(),
  learner: side.optional(),
  absentUserIds: z.array(z.uuid()).optional(),
  outcomeStatus: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
  determinedAt: date.optional(),
});
export const deadlinesSchema = z.object({
  reportBy: date.optional(),
  confirmBy: date,
  excuseOrReportBy: date,
  makeupBy: date,
});
export const reportingSchema = z.object({
  canReport: z.boolean(),
  blockedReason: z.string().nullable(),
  reportBy: date,
  evaluatedAt: z.iso.datetime({ offset: true }),
});
export const excuseSchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "EXPIRED"]),
  reason: z.string(),
  absentUserId: z.uuid(),
});
export const excuseReceipt = z.object({
  id: z.uuid(),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED"]),
});
