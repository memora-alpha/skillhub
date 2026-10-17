import { z } from "zod";

/** payOS's unqualified timestamps use Vietnam local time; invalid dates require review. */
export function paymentTime(value: string): Date | null {
  const local = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value);
  const normalized = local ? `${value.replace(" ", "T")}+07:00` : value;
  if (!z.iso.datetime({ offset: true }).safeParse(normalized).success)
    return null;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}
