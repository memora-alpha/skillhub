import { z } from "zod";
import { parseLocalDateTime } from "@/utils/local-date-time";
import type { LearningSession } from "../types";
import type { RescheduleInput } from "../api/reschedule-api";

export const rescheduleFormSchema = z.object({
  start: z
    .string()
    .refine((v) => !!parseLocalDateTime(v), "Chọn ngày giờ mới hợp lệ."),
  duration: z
    .string()
    .refine(
      (v) => /^\d+$/.test(v) && Number(v) >= 60 && Number(v) <= 180,
      "Thời lượng từ 60 đến 180 phút.",
    ),
});
export type RescheduleForm = z.infer<typeof rescheduleFormSchema>;
export function rescheduleAvailabilityMessage(
  session: Pick<LearningSession, "startAt"> & { status: string },
  now = Date.now(),
) {
  return isRescheduleEligible(session, now)
    ? "Chọn giờ mới trong tương lai. Hai bên cần xác nhận để lịch mới có hiệu lực."
    : "Buổi học không còn đủ điều kiện đổi lịch; lịch cũ vẫn có hiệu lực.";
}
export function rescheduleInput(
  form: RescheduleForm,
  expectedVersion: number,
  now = Date.now(),
): RescheduleInput | undefined {
  if (!rescheduleFormSchema.safeParse(form).success) return;
  const start = parseLocalDateTime(form.start)!;
  if (start.getTime() <= now) return;
  return {
    expectedVersion,
    startAt: start.toISOString(),
    endAt: new Date(
      start.getTime() + Number(form.duration) * 60_000,
    ).toISOString(),
  };
}
export function isRescheduleEligible(
  session: Pick<LearningSession, "startAt"> & { status: string },
  now = Date.now(),
) {
  return (
    ["CONFIRMED", "READY"].includes(session.status) &&
    Date.parse(session.startAt) - now >= 3_600_000
  );
}
