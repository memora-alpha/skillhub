import { Pressable, StyleSheet, Text, View } from "react-native";
import { appRadius, fonts, typography } from "@/constants/theme";
import { paymentPalette as colors } from "./wallet-payment-palette";

type FilterControlProps = {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
};

// Always-visible choices, shared by native and web, with no popup to dismiss.
export function HistoryFilterControl({
  label,
  value,
  options,
  onChange,
}: FilterControlProps) {
  return (
    <View accessibilityLabel={label} style={styles.track}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            aria-pressed={selected}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 4,
    gap: 4,
    borderRadius: appRadius.control,
    backgroundColor: colors.surfaceLow,
  },
  segment: {
    flex: 1,
    minWidth: 80,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appRadius.control - 4,
    borderWidth: 1,
    borderColor: "transparent",
  },
  selected: {
    backgroundColor: colors.surface,
    borderColor: colors.brandBorder,
  },
  label: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.body,
    textAlign: "center",
  },
  selectedLabel: { fontFamily: fonts.bold, color: colors.brandDark },
  pressed: { opacity: 0.7 },
});
