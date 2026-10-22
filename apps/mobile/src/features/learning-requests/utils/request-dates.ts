export {
  pickerValue,
  selectDatePart,
  webDateChoice,
  type DatePart,
} from "@/utils/date-choice";

export type SlotRow = { startAt: string; endAt: string };
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
