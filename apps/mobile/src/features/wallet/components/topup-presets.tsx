import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  appColors as colors,
  appRadius,
  fonts,
  signedInChrome,
  typography,
} from "@/constants/theme";
import { formatVnd } from "../utils/amount";

export function TopupPresets({
  value,
  disabled,
  onSelect,
}: {
  value: string;
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.row}>
      {["50000", "100000", "200000", "500000"].map((amount) => (
        <Pressable
          key={amount}
          accessibilityRole="button"
          accessibilityLabel={`Chọn ${formatVnd(amount)}`}
          accessibilityState={{ selected: value === amount, disabled }}
          disabled={disabled}
          onPress={() => onSelect(amount)}
          style={({ pressed }) => [
            styles.item,
            value === amount && styles.selected,
            pressed && { opacity: 0.75 },
            disabled && { opacity: 0.5 },
          ]}
        >
          <Text style={[styles.text, value === amount && styles.selectedText]}>
            {formatVnd(amount)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: appRadius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 44,
    minWidth: 108,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: {
    borderColor: signedInChrome.accent,
    backgroundColor: colors.primarySoft,
  },
  text: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.body,
  },
  selectedText: { color: colors.primaryDark },
});
