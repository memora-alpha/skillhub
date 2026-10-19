import { z } from "zod";
import { validateTimeZone } from "../../../shared/time/timestamp.policy";
import { creditUnits } from "../../proposals/domain/connection-policy";

export const WEEKDAYS = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;
export const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const IANA_ZONE_PATTERN = /^(?![+-])/;
const weeklySlotSchema = z
  .strictObject({
    weekday: z.enum(WEEKDAYS),
    startTime: z.string().regex(LOCAL_TIME_PATTERN),
    endTime: z.string().regex(LOCAL_TIME_PATTERN),
  })
  .refine((slot) => slot.endTime > slot.startTime);

export const preferredAvailabilitySchema = z
  .strictObject({
    timeZone: z
      .string()
      .regex(IANA_ZONE_PATTERN)
      .transform((value) => validateTimeZone(value)),
    weeklySlots: z.array(weeklySlotSchema).max(5),
  })
  .transform((value) => ({
    ...value,
    weeklySlots: [...value.weeklySlots].sort(
      (a, b) =>
        WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday) ||
        a.startTime.localeCompare(b.startTime),
    ),
  }))
  .refine(({ weeklySlots }) =>
    weeklySlots.every((slot, index) => {
      const previous = weeklySlots[index - 1];
      return (
        !previous ||
        slot.weekday !== previous.weekday ||
        slot.startTime >= previous.endTime
      );
    }),
  );

export type PreferredAvailability = z.output<
  typeof preferredAvailabilitySchema
>;
export const hourlyCreditSchema = z
  .string()
  .transform((value) => creditUnits(value))
  .refine((value) => value > 0n);
export function formatHourlyCredit(
  value: bigint | null | undefined,
): string | null {
  return value == null
    ? null
    : `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}
