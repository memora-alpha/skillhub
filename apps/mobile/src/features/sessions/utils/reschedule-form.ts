import { z } from "zod";
import { parseLocalDateTime } from "@/utils/local-date-time";
import type { LearningSession } from "../types";

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
export function buildRescheduleDraft(input: RescheduleForm, now = Date.now()) {
  const value = rescheduleFormSchema.parse(input);
  const start = parseLocalDateTime(value.start)!;
  if (start.getTime() <= now) throw new Error("Ngày giờ mới phải ở tương lai.");
  return {
    startAt: start.toISOString(),
    endAt: new Date(
      start.getTime() + Number(value.duration) * 60_000,
    ).toISOString(),
  };
}
export function rescheduleAvailability(
  session: Pick<LearningSession, "startAt"> & { status: string },
  now = Date.now(),
) {
  const eligible =
    session.status === "CONFIRMED" &&
    Date.parse(session.startAt) - now >= 3_600_000;
  return {
    available: false,
    message: eligible
      ? "Đổi lịch chưa khả dụng. Bạn có thể chuẩn bị giờ mới, nhưng chưa thể gửi đề nghị."
      : "Buổi học không còn đủ điều kiện đổi lịch; lịch cũ vẫn có hiệu lực.",
  };
}
