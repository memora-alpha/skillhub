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
  session: Pick<LearningSession, "startAt" | "allowedActions" | "deadlines"> & {
    status: string;
    rescheduleCount?: number;
  },
  now = Date.now(),
) {
  if (session.status === "MAKEUP_REQUIRED") {
    const deadline = session.deadlines?.makeupBy;
    if (deadline && Date.parse(deadline) <= now)
      return "Đã hết hạn chốt lịch học bù.";
    if (!deadline) return "Chưa có thời hạn học bù. Kéo xuống để cập nhật.";
    if (!session.allowedActions?.includes("PROPOSE_MAKEUP"))
      return "Chưa thể chọn lịch học bù. Kéo xuống để cập nhật trạng thái.";
    return "Hai bên cần xác nhận lịch học bù trước hạn.";
  }
  return isRescheduleEligible(session, now)
    ? "Hai bên cần xác nhận trước giờ học cũ ít nhất 60 phút. Lịch cũ giữ nguyên khi chưa chốt."
    : "Buổi học không còn đủ điều kiện đổi lịch.";
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
  session: Pick<LearningSession, "startAt" | "allowedActions" | "deadlines"> & {
    status: string;
    rescheduleCount?: number;
  },
  now = Date.now(),
) {
  if (session.status === "MAKEUP_REQUIRED")
    return (
      !!session.allowedActions?.includes("PROPOSE_MAKEUP") &&
      !!session.deadlines?.makeupBy &&
      Date.parse(session.deadlines.makeupBy) > now
    );
  return (
    ["CONFIRMED", "READY"].includes(session.status) &&
    (session.rescheduleCount ?? 0) < 3 &&
    Date.parse(session.startAt) - now >= 3_600_000
  );
}
