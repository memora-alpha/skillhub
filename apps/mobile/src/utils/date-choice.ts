import { parseLocalDateTime } from "./local-date-time";

export type DatePart = "date" | "time";
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
