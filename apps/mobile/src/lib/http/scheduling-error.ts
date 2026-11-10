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
const invalidTimeItem = z
  .object({
    planId: z.uuid(),
    planVersion: z.number().int().positive(),
    scheduleId: z.uuid(),
    scheduleVersion: z.number().int().positive(),
    teacherId: z.uuid(),
    learnerId: z.uuid(),
    sessionNo: z.number().int().positive(),
    // Do not require endAt > startAt: that is one of the errors being reported.
    startAt: z.iso.datetime({ offset: true }),
    endAt: z.iso.datetime({ offset: true }),
    reasons: z
      .array(
        z.enum([
          "START_NOT_IN_FUTURE",
          "END_NOT_AFTER_START",
          "DURATION_TOO_SHORT",
          "DURATION_TOO_LONG",
        ]),
      )
      .min(1)
      .max(4)
      .refine((reasons) => new Set(reasons).size === reasons.length),
  })
  .refine((item) => item.teacherId !== item.learnerId);
const invalidTimes = z.object({
  invalidItems: z.array(invalidTimeItem).min(1).max(200),
  evaluatedAt: z.iso.datetime({ offset: true }),
  durationMinutes: z
    .object({
      min: z.number().int().positive(),
      max: z.number().int().positive(),
    })
    .refine((policy) => policy.min <= policy.max),
});
export type InvalidScheduleDetails = z.infer<typeof invalidTimes>;
export type SchedulingErrorDetails =
  z.infer<typeof schedule> | z.infer<typeof credit> | InvalidScheduleDetails;

export function readSchedulingError(
  status: number,
  code: string,
  details: unknown,
) {
  if (status !== 409) return undefined;
  if (code === "INVALID_SCHEDULE_ITEMS")
    return invalidTimes.safeParse(details).data;
  if (code === "SCHEDULE_CONFLICT") return schedule.safeParse(details).data;
  if (code === "INSUFFICIENT_AVAILABLE_CREDIT")
    return credit.safeParse(details).data;
  return undefined;
}

export function invalidScheduleDetails(error: unknown) {
  if (
    !(error instanceof AppError) ||
    error.status !== 409 ||
    error.code !== "INVALID_SCHEDULE_ITEMS"
  )
    return undefined;
  return invalidTimes.safeParse(error.details).data;
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
    const comparedLabel =
      conflict.type === "INTERNAL" ? "buổi" : "buổi đã chốt";
    let reason =
      conflict.type === "INTERNAL"
        ? "Các buổi đề xuất bị trùng"
        : "Trùng với một buổi đã đặt";
    if (conflict.proposed && conflict.compared)
      reason = `Buổi ${conflict.proposed.sessionNo} trùng ${comparedLabel} ${conflict.compared.sessionNo}`;
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
