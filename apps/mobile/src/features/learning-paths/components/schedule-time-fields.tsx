import { View } from "react-native";
import { DateTimeField } from "@/components/DateTimeField";
import { Input } from "@/components/Input";
import { Copy } from "@/components/feature-page";

export function ScheduleTimeFields({
  local,
  minutes,
  disabled,
  onLocalChange,
  onMinutesChange,
}: Readonly<{
  local: string;
  minutes: string;
  disabled: boolean;
  onLocalChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
}>) {
  return (
    <View style={{ gap: 12 }}>
      <DateTimeField
        label="Ngày và giờ bắt đầu"
        value={local}
        disabled={disabled}
        onChange={onLocalChange}
      />
      <Input
        label="Học trong bao lâu?"
        value={minutes}
        keyboardType="number-pad"
        inputMode="numeric"
        editable={!disabled}
        onChangeText={(value) => {
          if (!disabled) onMinutesChange(value);
        }}
        placeholder="Ví dụ: 90"
        hint="Nhập từ 60 đến 180 phút."
        rightAccessory={
          <Copy muted size="hint">
            phút
          </Copy>
        }
      />
    </View>
  );
}
