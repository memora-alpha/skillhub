import { Host } from "@expo/ui";
import { DatePicker } from "@expo/ui/swift-ui";
import {
  datePickerStyle,
  environment,
  font,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { appColors, fonts } from "@/constants/theme";
import type { RequestDatePickerProps } from "./request-date-picker";
import { RequestCalendar } from "./request-calendar";

export function RequestDatePicker({
  value,
  mode,
  onChange,
}: Readonly<RequestDatePickerProps>) {
  if (mode === "date")
    return <RequestCalendar value={value} onChange={onChange} />;
  return (
    <Host
      matchContents={{ vertical: true }}
      style={{ width: "100%" }}
      ignoreSafeArea="all"
    >
      <DatePicker
        selection={value}
        onDateChange={onChange}
        displayedComponents={["hourAndMinute"]}
        modifiers={[
          datePickerStyle("wheel"),
          font({ family: fonts.body, size: 13, textStyle: "caption" }),
          environment("locale", "vi_VN"),
          environment("colorScheme", "light"),
          tint(appColors.primary),
        ]}
      />
    </Host>
  );
}
