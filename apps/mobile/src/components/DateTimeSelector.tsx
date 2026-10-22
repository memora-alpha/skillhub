import DateTimePicker from "@expo/ui/community/datetime-picker";
import { Platform } from "react-native";
import { appColors } from "@/constants/theme";
import type { DatePart } from "@/utils/date-choice";
import { CalendarPicker } from "./CalendarPicker";

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
  return (
    <DateTimePicker
      value={value}
      mode={mode}
      presentation="inline"
      display={Platform.OS === "ios" ? "spinner" : "default"}
      onValueChange={(_event, date) => onChange(date)}
      locale="vi_VN"
      is24Hour
      accentColor={appColors.primary}
      themeVariant="light"
      style={{ width: "100%" }}
    />
  );
}
