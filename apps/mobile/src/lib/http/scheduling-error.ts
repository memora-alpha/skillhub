import { z } from "zod";
import { AppError } from "./errors";

const overlap = z
  .object({
    type: z.enum(["INTERNAL", "SESSION"]),
    overlapStartAt: z.iso.datetime(),
    overlapEndAt: z.iso.datetime(),
  })
  .refine(
    (window) =>
      Date.parse(window.overlapStartAt) < Date.parse(window.overlapEndAt),
  );
const schedule = z.object({ conflicts: z.array(overlap).min(1).max(100) });
const credit = z.object({ userIds: z.array(z.uuid()).min(1).max(2) });
export type SchedulingErrorDetails =
  z.infer<typeof schedule> | z.infer<typeof credit>;

export function readSchedulingError(
  status: number,
  code: string,
  details: unknown,
) {
  if (status !== 409) return undefined;
  if (code === "SCHEDULE_CONFLICT") return schedule.safeParse(details).data;
  if (code === "INSUFFICIENT_AVAILABLE_CREDIT")
    return credit.safeParse(details).data;
  return undefined;
}

export function scheduleConflictMessage(error: unknown) {
  if (
    !(error instanceof AppError) ||
    error.code !== "SCHEDULE_CONFLICT" ||
    !error.details ||
    !("conflicts" in error.details)
  )
    return undefined;
  const { conflicts } = error.details;
  const [first] = conflicts;
  if (!first) return undefined;
  const format = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const start = format.format(new Date(first.overlapStartAt));
  const end = format.format(new Date(first.overlapEndAt));
  const reason =
    first.type === "INTERNAL"
      ? "Các buổi đề xuất bị trùng"
      : "Trùng với một buổi đã đặt";
  const remainingCount = conflicts.length - 1;
  const more = remainingCount ? ` Còn ${remainingCount} mục trùng khác.` : "";
  return `${reason} từ ${start} đến ${end} (giờ thiết bị).${more} Hãy chọn giờ khác.`;
}

export function creditShortfall(error: unknown, viewerId?: string) {
  if (
    !(error instanceof AppError) ||
    error.code !== "INSUFFICIENT_AVAILABLE_CREDIT"
  )
    return undefined;
  if (!error.details || !("userIds" in error.details) || !viewerId)
    return "unknown";
  return error.details.userIds.includes(viewerId) ? "viewer" : "other";
}
