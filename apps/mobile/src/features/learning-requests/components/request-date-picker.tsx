import DateTimePicker from "@expo/ui/community/datetime-picker";
import { Platform } from "react-native";
import { appColors } from "@/constants/theme";
import type { DatePart } from "../utils/request-dates";
import { RequestCalendar } from "./request-calendar";

export type RequestDatePickerProps = {
  value: Date;
  mode: DatePart;
  onChange: (date: Date) => void;
};
export function RequestDatePicker({
  value,
  mode,
  onChange,
}: RequestDatePickerProps) {
  if (mode === "date")
    return <RequestCalendar value={value} onChange={onChange} />;
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
