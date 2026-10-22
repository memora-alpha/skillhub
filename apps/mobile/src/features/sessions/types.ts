import { z } from "zod";

export const sessionStatuses = [
  "CONFIRMED",
  "READY",
  "ONGOING",
  "AWAITING_CONFIRMATION",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
] as const;
const timestamp = z.iso
  .datetime({ offset: true })
  .refine((v) => Number.isFinite(Date.parse(v)));
const progressCount = z
  .object({
    completed: z.number().int().nonnegative().safe(),
    total: z.number().int().nonnegative().safe(),
  })
  .refine((value) => value.completed <= value.total);
const progress = z
  .object({ agreement: progressCount, plan: progressCount })
  .refine(
    (value) =>
      value.plan.total <= value.agreement.total &&
      value.plan.completed <= value.agreement.completed,
  );
export const sessionSchema = z
  .object({
    id: z.uuid(),
    pathId: z.uuid(),
    planId: z.uuid(),
    planVersion: z.number().int().positive().safe().optional(),
    outlineSessionNo: z.number().int().positive().safe().optional(),
    progress: progress.optional(),
    teacherId: z.uuid(),
    learnerId: z.uuid(),
    startAt: timestamp,
    endAt: timestamp,
    status: z.enum(sessionStatuses),
    teacherConfirmationStatus: z.string().nullable(),
    learnerConfirmationStatus: z.string().nullable(),
    teacherConfirmedAt: timestamp.nullable().optional(),
    learnerConfirmedAt: timestamp.nullable().optional(),
    cancelledAt: timestamp.nullable().optional(),
    cancelReason: z.string().nullable().optional(),
    role: z.enum(["TEACHER", "LEARNER"]).optional(),
  })
  .refine((s) => Date.parse(s.endAt) > Date.parse(s.startAt));
export const completionReceiptSchema = z.object({
  id: z.uuid(),
  status: z.enum(["AWAITING_CONFIRMATION", "COMPLETED"]),
});
export type LearningSession = z.infer<typeof sessionSchema>;
export type SessionSummary = Pick<
  LearningSession,
  "id" | "teacherId" | "learnerId" | "startAt" | "endAt" | "status"
>;
export type CompletionReceipt = z.infer<typeof completionReceiptSchema>;
export type SessionRange = { from: string; to: string };
export const sessionStatusLabels: Record<LearningSession["status"], string> = {
  CONFIRMED: "Đã chốt lịch",
  READY: "Sẵn sàng",
  ONGOING: "Đang học",
  AWAITING_CONFIRMATION: "Chờ xác nhận",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
  DISPUTED: "Đang tranh chấp",
};
