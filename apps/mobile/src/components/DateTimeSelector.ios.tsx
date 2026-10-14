import { Host } from "@expo/ui";
import { DatePicker } from "@expo/ui/swift-ui";
import {
  datePickerStyle,
  environment,
  font,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { appColors, fonts, typography } from "@/constants/theme";
import type { DateTimeSelectorProps } from "./DateTimeSelector";
import { CalendarPicker } from "./CalendarPicker";

export function DateTimeSelector({
  value,
  mode,
  onChange,
}: Readonly<DateTimeSelectorProps>) {
  if (mode === "date")
    return <CalendarPicker value={value} onChange={onChange} />;
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
          font({
            family: fonts.body,
            size: typography.body.fontSize,
            textStyle: "body",
          }),
          environment("locale", "vi_VN"),
          environment("colorScheme", "light"),
          tint(appColors.primary),
        ]}
      />
    </Host>
  );
}
