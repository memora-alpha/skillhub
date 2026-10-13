import { z } from "zod";
import {
  weekdays,
  validWeeklyRows,
  weeklyRowsValue,
} from "../utils/request-weekly-slots";

export function validTimeZone(value: string) {
  if (!value || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
export function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
export const availabilitySchema = z
  .object({
    timeZone: z.string().refine(validTimeZone),
    weeklySlots: z
      .array(
        z.object({
          weekday: z.enum(weekdays),
          startTime: z.string(),
          endTime: z.string(),
        }),
      )
      .max(5)
      .refine((rows) => validWeeklyRows(weeklyRowsValue(rows))),
  })
  .transform((value) => ({
    ...value,
    weeklySlots: [...value.weeklySlots].sort(
      (a, b) =>
        weekdays.indexOf(a.weekday) - weekdays.indexOf(b.weekday) ||
        a.startTime.localeCompare(b.startTime),
    ),
  }));
export const creditSchema = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
    "Nhập Credit bằng số, tối đa 10 chữ số nguyên và 2 chữ số thập phân.",
  )
  .refine((value) => Number(value) > 0, "Credit mong muốn phải lớn hơn 0.");
export function normalizeCredit(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}
export const idsSchema = z
  .array(z.uuid("Chọn mục hợp lệ trong danh mục."))
  .max(10, "Chọn tối đa 10 mục.")
  .refine(
    (ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
    "Chọn tối đa 10 mục khác nhau trong danh mục.",
  )
  .transform((ids) => ids.map((id) => id.toLowerCase()));
export const offeringSchema = z.object({
  id: z.uuid(),
  skill: z.object({ id: z.uuid(), name: z.string() }),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]),
  verificationStatus: z.string(),
});
export const cardPreferences = {
  teachingOverview: z.string().nullable().default(null),
  preferredAvailability: availabilitySchema.nullable().default(null),
  desiredCreditPerHour: creditSchema.nullable().default(null),
  offeredSharingSkills: z.array(offeringSchema).default([]),
};
export type PreferredAvailability = z.infer<typeof availabilitySchema>;
