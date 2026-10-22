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
export function rescheduleUnavailableMessage(
  session: Pick<LearningSession, "startAt"> & { status: string },
  now = Date.now(),
) {
  return isRescheduleEligible(session, now)
    ? "Đổi lịch chưa khả dụng. Bạn có thể chuẩn bị giờ mới, nhưng chưa thể gửi đề nghị."
    : "Buổi học không còn đủ điều kiện đổi lịch; lịch cũ vẫn có hiệu lực.";
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
