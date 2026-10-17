import { Host, Picker } from "@expo/ui";
import { appColors } from "@/constants/theme";
export type FilterControlProps = {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
};

// SDK57 universal Picker on native. Prefix values with field purpose because
// this installed Picker has no accessibilityLabel prop; native acceptance pending.
export function HistoryFilterControl({
  label,
  value,
  options,
  onChange,
}: FilterControlProps) {
  return (
    <Host
      matchContents
      seedColor={appColors.primary}
      accessibilityLabel={label}
    >
      <Picker selectedValue={value} onValueChange={onChange}>
        {options.map((option) => (
          <Picker.Item
            key={option.value}
            value={option.value}
            label={`${label}: ${option.label}`}
          />
        ))}
      </Picker>
    </Host>
  );
}
