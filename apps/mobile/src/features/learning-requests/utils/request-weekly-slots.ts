import { z } from "zod";

export const weekdays = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;
export const weekdayLabels = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "Chủ nhật",
] as const;
const rowsSchema = z
  .array(
    z.object({
      weekday: z.enum(["", ...weekdays]),
      startTime: z.string(),
      endTime: z.string(),
    }),
  )
  .max(5);
export type WeeklyRow = z.infer<typeof rowsSchema>[number];
export function weeklyRows(value: string): WeeklyRow[] | undefined {
  if (!value.trim()) return [];
  try {
    const result = rowsSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}
export function weeklyRowsValue(rows: WeeklyRow[]) {
  return rows.length ? JSON.stringify(rows) : "";
}
export function validWeeklyRows(value: string) {
  const rows = weeklyRows(value);
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  return (
    !!rows &&
    rows.every(
      (row, index) =>
        !!row.weekday &&
        clock.test(row.startTime) &&
        clock.test(row.endTime) &&
        row.endTime > row.startTime &&
        !rows
          .slice(0, index)
          .some(
            (other) =>
              other.weekday === row.weekday &&
              row.startTime < other.endTime &&
              row.endTime > other.startTime,
          ),
    )
  );
}
