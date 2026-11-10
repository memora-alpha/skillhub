import type { DatePart } from "@/utils/date-choice";
import { CalendarPicker } from "./CalendarPicker";
import { TimeWheelPicker } from "./TimeWheelPicker";

export type DateTimeSelectorProps = {
  value: Date;
  mode: DatePart;
  onChange: (date: Date) => void;
};
export function DateTimeSelector({
  value,
  mode,
  onChange,
}: Readonly<DateTimeSelectorProps>) {
  if (mode === "date")
    return <CalendarPicker value={value} onChange={onChange} />;
  return <TimeWheelPicker value={value} onChange={onChange} />;
}
