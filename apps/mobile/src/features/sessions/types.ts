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
export const sessionSchema = z
  .object({
    id: z.uuid(),
    pathId: z.uuid(),
    planId: z.uuid(),
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
