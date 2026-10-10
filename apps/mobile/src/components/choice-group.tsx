import { Pressable, Text, View } from "react-native";
import { appColors as colors, fonts } from "@/constants/theme";
import { uiLabel } from "@/constants/ui-copy";
export function ChoiceGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.bold, color: colors.body }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === option }}
            aria-checked={value === option}
            onPress={() => onChange(option)}
            style={{
              padding: 12,
              minHeight: 44,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: value === option ? colors.primary : colors.border,
              backgroundColor:
                value === option ? colors.primarySoft : colors.surface,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.semibold,
                color: value === option ? colors.primary : colors.body,
              }}
            >
              {uiLabel(option)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
