import { parseLocalDateTime } from "@/utils/local-date-time";

export type SlotRow = { startAt: string; endAt: string };
export type DatePart = "date" | "time";
export function slotRows(value: string): SlotRow[] {
  return value.trim()
    ? value.split("\n").map((row) => {
        const [startAt = "", endAt = ""] = row.split("→");
        return { startAt: startAt.trim(), endAt: endAt.trim() };
      })
    : [];
}
export function slotRowsValue(rows: SlotRow[]) {
  return rows.map((row) => `${row.startAt} → ${row.endAt}`).join("\n");
}
export function pickerValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function selectDatePart(current: Date, selected: Date, part: DatePart) {
  const next = new Date(current);
  if (part === "date")
    next.setFullYear(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate(),
    );
  else next.setHours(selected.getHours(), selected.getMinutes());
  return next;
}
export function webDateChoice(current: Date, value: string, part: DatePart) {
  const [date, time] = pickerValue(current).split("T");
  return parseLocalDateTime(
    part === "date" ? `${value}T${time}` : `${date}T${value}`,
  );
}
