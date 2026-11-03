import { z } from "zod";
import { AppError } from "./errors";

const sessionWindow = z
  .object({
    sessionNo: z.number().int().positive(),
    startAt: z.iso.datetime({ offset: true }),
    endAt: z.iso.datetime({ offset: true }),
  })
  .refine((window) => Date.parse(window.startAt) < Date.parse(window.endAt));
const overlap = z
  .object({
    type: z.enum(["INTERNAL", "SESSION"]),
    proposed: sessionWindow.optional(),
    compared: sessionWindow.optional(),
    overlapStartAt: z.iso.datetime({ offset: true }),
    overlapEndAt: z.iso.datetime({ offset: true }),
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
  const parsed = schedule.safeParse(error.details);
  if (!parsed.success) return undefined;
  const { conflicts } = parsed.data;
  const [first] = conflicts;
  if (!first) return undefined;
  const format = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const visible = conflicts.slice(0, 3);
  const descriptions = visible.map((conflict) => {
    const start = format.format(new Date(conflict.overlapStartAt));
    const end = format.format(new Date(conflict.overlapEndAt));
    const reason =
      conflict.proposed && conflict.compared
        ? `Buổi ${conflict.proposed.sessionNo} trùng ${conflict.type === "INTERNAL" ? "buổi" : "buổi đã chốt"} ${conflict.compared.sessionNo}`
        : conflict.type === "INTERNAL"
          ? "Các buổi đề xuất bị trùng"
          : "Trùng với một buổi đã đặt";
    return `${reason} từ ${start} đến ${end} (giờ thiết bị).`;
  });
  const remainingCount = conflicts.length - visible.length;
  const more = remainingCount ? ` Còn ${remainingCount} mục trùng khác.` : "";
  return `${descriptions.join(" ")}${more} Hãy chọn giờ khác.`;
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
